require('dotenv').config();

const path = require('path');
const crypto = require('crypto');
const express = require('express');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const {
  openDb,
  run,
  initSchema,
  getUserByEmail,
  getUserById,
  createUser,
  saveRefreshToken,
  getRefreshToken,
  deleteRefreshToken,
  deleteUserRefreshTokens,
  markUserEmailVerified,
  updateUnverifiedUserCredentials,
  createEmailVerificationOtp,
  getLatestUnexpiredOtpForUserEmail,
  markOtpAsUsed,
  incrementVerificationFailedAttempts,
  resetVerificationFailedAttempts,
  lockVerificationAttempts,
  isVerificationLocked,
  recordResendAttempt,
  getResendAttemptsInWindow,
  cleanupOldResendAttempts,
  getAllActiveAds,
  getAdById,
  createAd,
  updateAdStatus,
  deleteAd,
  getAllSpareParts,
  getSparePartById,
  createSparePart,
  deleteSparePart,
  seedPreloadedAds,
  // Admin functions
  getAllUsers,
  getUserAdCount,
  updateUserStatus,
  deleteUserById,
  getAllAds,
  updateAdFeatured,
  getFeaturedAds,
  getPendingAds,
  logActivity,
  getRecentActivities,
  createPayment,
  getRevenueStats,
  getMonthlyRevenueData,
  getMonthlyUserData,
  getMonthlyAdData,
  getRecentPayments,
  getDashboardStats,
  getAllAdmins,
  updateUserLastLogin,
  updateAdminLastLogin,
} = require('./database');

const {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
  requireAuth,
  requireAdmin,
  REFRESH_EXPIRY_MS,
} = require('./middleware/auth');

const { loginRateLimiter, otpVerifyRateLimiter, resetLoginAttempts } = require('./middleware/rateLimit');
const { createUploadMiddleware, isCloudinaryConfigured, uploadFilesToCloudinary } = require('./config/cloudinary');
const { sendVerificationEmail, isEmailConfigured } = require('./config/email');
const PRELOADED_ADS = require('./seed-data');

const app = express();
const ROOT_DIR = path.join(__dirname, '..');

const BCRYPT_ROUNDS = 12;
const AD_POSTING_FEE = Number(process.env.AD_POSTING_FEE_CENTS || 99900);
const AD_CURRENCY = process.env.STRIPE_CURRENCY || 'lkr';

let stripe = null;
if (process.env.STRIPE_SECRET_KEY) {
  stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
}

app.set('trust proxy', 1);

app.use(
  cors({
    origin: true,
    credentials: true,
  })
);

app.post(
  '/api/payment/webhook',
  express.raw({ type: 'application/json' }),
  async (req, res) => {
    if (!stripe || !process.env.STRIPE_WEBHOOK_SECRET) {
      return res.status(503).json({ ok: false, error: 'Stripe webhook not configured' });
    }

    const sig = req.headers['stripe-signature'];
    let event;

    try {
      event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
    } catch (err) {
      return res.status(400).json({ ok: false, error: `Webhook Error: ${err.message}` });
    }

    if (event.type === 'payment_intent.succeeded') {
      const adId = event.data.object.metadata?.adId;
      if (adId) {
        const db = openDb();
        await updateAdStatus(db, adId, 'active');
        db.close();
      }
    }

    res.json({ received: true });
  }
);

app.use(cookieParser());
app.use(express.json({ limit: '10mb' }));

const upload = createUploadMiddleware();

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function setRefreshCookie(res, token) {
  res.cookie('ceylon_refresh', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: REFRESH_EXPIRY_MS,
    path: '/api/auth',
  });
}

function clearRefreshCookie(res) {
  res.clearCookie('ceylon_refresh', { path: '/api/auth' });
}

function publicUser(user) {
  return { id: user.id, name: user.name, email: user.email, role: user.role || 'user' };
}

async function issueTokens(res, user) {
  const accessToken = signAccessToken(user);
  const refreshToken = signRefreshToken(user);
  const expiresAt = new Date(Date.now() + REFRESH_EXPIRY_MS).toISOString();

  const db = openDb();
  await deleteUserRefreshTokens(db, user.id);
  await saveRefreshToken(db, user.id, hashToken(refreshToken), expiresAt);
  db.close();

  setRefreshCookie(res, refreshToken);
  return accessToken;
}

function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email).trim());
}

const ALLOWED_EMAIL_DOMAINS = String(process.env.ALLOWED_EMAIL_DOMAINS || '')
  .split(',')
  .map((d) => d.trim().toLowerCase())
  .filter(Boolean);

function isEmailDomainAllowed(email) {
  if (ALLOWED_EMAIL_DOMAINS.length === 0) {
    // If not configured, allow all domains (backward compatible dev mode)
    return true;
  }
  const normalizedEmail = String(email).trim().toLowerCase();
  const at = normalizedEmail.lastIndexOf('@');
  if (at === -1) return false;
  const domain = normalizedEmail.slice(at + 1);
  return ALLOWED_EMAIL_DOMAINS.includes(domain);
}

// ── OTP Generation & Hashing ───────────────────────────────────────────────
function generateOtp() {
  // Generate a random 6-digit OTP using crypto for better randomness
  const randomBytes = crypto.randomBytes(3);
  const randomNum = randomBytes.readUIntBE(0, 3) % 1000000;
  return String(randomNum).padStart(6, '0');
}

async function hashOtp(otp) {
  // Use bcrypt for secure OTP hashing (more secure than plain SHA256)
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(String(otp), salt);
}

async function verifyOtp(otp, hash) {
  // Compare OTP with hash using bcrypt
  return bcrypt.compare(String(otp), hash);
}

function createOtpVerificationCodeHash(otpCode) {
  // For backward compatibility, keep this for now but use bcrypt in new code
  return crypto.createHash('sha256').update(String(otpCode)).digest('hex');
}

app.get('/api/config/public', (_req, res) => {
  res.json({
    ok: true,
    stripePublishableKey: process.env.STRIPE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || '',
    adPostingFee: AD_POSTING_FEE,
    adPostingFeeDisplay: `LKR ${(AD_POSTING_FEE / 100).toLocaleString('en-LK')}`,
    currency: AD_CURRENCY,
    cloudinaryConfigured: isCloudinaryConfigured(),
  });
});

app.get('/api/auth/me', requireAuth, async (req, res) => {
  try {
    const db = openDb();
    const user = await getUserById(db, req.user.id);
    db.close();

    if (!user) {
      return res.status(401).json({ ok: false, error: 'User not found' });
    }

    return res.json({ ok: true, user: publicUser(user) });
  } catch {
    return res.status(500).json({ ok: false, error: 'Server error' });
  }
});

app.post('/api/auth/register', registerUser);
app.post('/api/auth/signup', registerUser);
app.post('/api/auth/verify-registration', otpVerifyRateLimiter, verifyRegistrationOtp);
app.post('/api/auth/resend-otp', resendOtp);

function createOtpVerificationCodeHash(otpCode) {
  return crypto.createHash('sha256').update(String(otpCode)).digest('hex');
}

function jwtSignEmailVerificationToken(userId, email) {
  const secret = process.env.JWT_EMAIL_VERIFICATION_SECRET || 'local-dev-email-verification-secret-change-me';
  return jwt.sign(
    { sub: userId, email, type: 'email_verification' },
    secret,
    { expiresIn: '30m' }
  );
}

function jwtVerifyEmailVerificationToken(token) {
  const secret = process.env.JWT_EMAIL_VERIFICATION_SECRET || 'local-dev-email-verification-secret-change-me';
  return jwt.verify(token, secret);
}

async function resendOtp(req, res) {
  try {
    const { verificationToken } = req.body || {};

    if (!verificationToken) {
      return res.status(400).json({ ok: false, error: 'verificationToken is required' });
    }

    let payload;
    try {
      payload = jwtVerifyEmailVerificationToken(verificationToken);
    } catch {
      return res.status(401).json({ ok: false, error: 'Invalid or expired verification token. Please register again.' });
    }

    if (payload.type !== 'email_verification') {
      return res.status(401).json({ ok: false, error: 'Invalid verification token' });
    }

    const userId = payload.sub;
    const email = String(payload.email || '').trim().toLowerCase();

    const db = openDb();
    const user = await getUserById(db, userId);

    if (!user) {
      db.close();
      return res.status(404).json({ ok: false, error: 'User not found' });
    }

    if (user.email_verified === 1) {
      db.close();
      return res.status(400).json({ ok: false, error: 'Email is already verified' });
    }

    // Check resend rate limit (max 3 attempts per 15 minutes)
    const RESEND_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
    const MAX_RESEND_ATTEMPTS = 3;
    
    const resendCount = await getResendAttemptsInWindow(db, userId, RESEND_WINDOW_MS);
    
    if (resendCount >= MAX_RESEND_ATTEMPTS) {
      db.close();
      return res.status(429).json({
        ok: false,
        error: 'Too many resend requests. Please wait 15 minutes before trying again.'
      });
    }

    // Record this resend attempt
    await recordResendAttempt(db, userId);

    // Generate a new OTP using secure random generation
    const otpCode = generateOtp();
    const otpCodeHash = createOtpVerificationCodeHash(otpCode);
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

    await createEmailVerificationOtp(db, {
      userId,
      email,
      codeHash: otpCodeHash,
      expiresAt,
    });

    db.close();

    // Issue a fresh verification token so the 30-min window resets
    const newVerificationToken = jwtSignEmailVerificationToken(userId, email);

    // Send verification email
    const emailResult = await sendVerificationEmail({
      to: email,
      otpCode,
      userName: user.name,
    });

    return res.json({
      ok: true,
      message: 'Verification code sent successfully',
      verificationToken: newVerificationToken,
      resendAttemptsRemaining: MAX_RESEND_ATTEMPTS - resendCount - 1,
      // Only expose the raw code in dev mode (no email configured)
      ...(emailResult.devMode && { otpCode }),
    });
  } catch (err) {
    console.error('[resend-otp]', err);
    return res.status(500).json({ ok: false, error: 'Server error' });
  }
}

async function verifyRegistrationOtp(req, res) {
  try {
    const { verificationToken, otp } = req.body || {};

    if (!verificationToken || !otp) {
      return res.status(400).json({ ok: false, error: 'verificationToken and otp are required' });
    }

    let payload;
    try {
      payload = jwtVerifyEmailVerificationToken(verificationToken);
    } catch {
      return res.status(401).json({ ok: false, error: 'Invalid or expired verification token' });
    }

    if (payload.type !== 'email_verification') {
      return res.status(401).json({ ok: false, error: 'Invalid verification token' });
    }

    const userId = payload.sub;
    const email = String(payload.email || '').trim().toLowerCase();

    if (!email || !validateEmail(email) || !isEmailDomainAllowed(email)) {
      return res.status(400).json({ ok: false, error: 'Email is not allowed' });
    }

    const otpStr = String(otp).trim();
    if (!/^\d{6}$/.test(otpStr)) {
      return res.status(400).json({ ok: false, error: 'OTP must be a 6-digit code' });
    }

    const db = openDb();
    const user = await getUserById(db, userId);

    if (!user) {
      db.close();
      return res.status(404).json({ ok: false, error: 'User not found' });
    }

    // Check if account is locked due to too many failed attempts
    const isLocked = await isVerificationLocked(db, userId);
    if (isLocked) {
      const lockedUntil = new Date(user.verification_locked_until);
      const now = new Date();
      const minutesRemaining = Math.ceil((lockedUntil - now) / (60 * 1000));
      db.close();
      return res.status(429).json({
        ok: false,
        error: `Too many failed verification attempts. Please try again in ${minutesRemaining} minutes.`
      });
    }

    const nowIso = new Date().toISOString();
    const latestOtp = await getLatestUnexpiredOtpForUserEmail(db, { userId, email, nowIso });
    
    if (!latestOtp) {
      db.close();
      return res.status(400).json({ ok: false, error: 'Verification code expired. Please request a new one.' });
    }

    const otpHash = createOtpVerificationCodeHash(otpStr);

    if (latestOtp.code_hash !== otpHash) {
      // Track failed attempt
      await incrementVerificationFailedAttempts(db, userId);
      const failedAttempts = user.verification_failed_attempts + 1;
      
      const MAX_FAILED_ATTEMPTS = 5;
      if (failedAttempts >= MAX_FAILED_ATTEMPTS) {
        // Lock account for 30 minutes
        const lockUntilTime = new Date(Date.now() + 30 * 60 * 1000).toISOString();
        await lockVerificationAttempts(db, userId, lockUntilTime);
        db.close();
        return res.status(429).json({
          ok: false,
          error: 'Too many failed verification attempts. Account locked for 30 minutes.'
        });
      }

      db.close();
      return res.status(401).json({
        ok: false,
        error: 'Invalid verification code',
        attemptsRemaining: MAX_FAILED_ATTEMPTS - failedAttempts
      });
    }

    // Successful verification - reset failed attempts and mark email as verified
    await resetVerificationFailedAttempts(db, userId);
    await markOtpAsUsed(db, latestOtp.id);
    await markUserEmailVerified(db, userId);

    const verifiedUser = await getUserById(db, userId);
    db.close();

    if (!verifiedUser) {
      return res.status(404).json({ ok: false, error: 'User not found' });
    }

    const accessToken = await issueTokens(res, verifiedUser);
    return res.json({
      ok: true,
      message: 'Email verified successfully',
      user: publicUser(verifiedUser),
      accessToken
    });
  } catch (err) {
    console.error('[verify-registration]', err);
    return res.status(500).json({ ok: false, error: 'Server error' });
  }
}


// ── OAuth upsert ── finds or creates user without a password
app.post('/api/auth/oauth-login', async (req, res) => {
  try {
    const { name, email, provider } = req.body || {};

    if (!email || !name) {
      return res.status(400).json({ ok: false, error: 'Name and email are required' });
    }
    if (!validateEmail(email)) {
      return res.status(400).json({ ok: false, error: 'Invalid email' });
    }
    if (!isEmailDomainAllowed(email)) {
      return res.status(400).json({ ok: false, error: 'Email domain is not allowed' });
    }


    const normalizedEmail = String(email).trim().toLowerCase();
    const db = openDb();
    let user = await getUserByEmail(db, normalizedEmail);

    if (!user) {
      // Create account with a random unusable password hash
      const randomPassword = crypto.randomBytes(32).toString('hex');
      const passwordHash = await bcrypt.hash(randomPassword, BCRYPT_ROUNDS);
      user = await createUser(db, {
        name: String(name).trim(),
        email: normalizedEmail,
        passwordHash,
      });
    }

    if (user.email_verified !== 1) {
      // Mark OAuth signups as verified.
      await markUserEmailVerified(db, user.id);
    }

    db.close();
    const accessToken = await issueTokens(res, user);
    return res.json({ ok: true, user: publicUser(user), accessToken });
  } catch (err) {
    console.error('[oauth-login]', err);
    return res.status(500).json({ ok: false, error: 'Server error' });
  }
});

async function registerUser(req, res) {
  // STEP 1: create pending user + issue OTP (do NOT authenticate)
  try {
    const { name, email, password } = req.body || {};

    if (!name || !email || !password) {
      return res.status(400).json({ ok: false, error: 'Name, email, and password are required' });
    }

    if (!validateEmail(email)) {
      return res.status(400).json({ ok: false, error: 'Invalid email format' });
    }

    if (!isEmailDomainAllowed(email)) {
      return res.status(400).json({ ok: false, error: 'Email domain is not allowed' });
    }

    if (String(password).length < 8) {
      return res.status(400).json({ ok: false, error: 'Password must be at least 8 characters' });
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const db = openDb();

    const existing = await getUserByEmail(db, normalizedEmail);
    if (existing) {
      // Allow re-registration if the existing account is still unverified
      if (existing.email_verified === 1) {
        db.close();
        return res.status(409).json({ ok: false, error: 'Email already in use' });
      }
      // Unverified account — update password and re-issue OTP so the user can retry
      const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
      await updateUnverifiedUserCredentials(db, existing.id, String(name).trim(), passwordHash);
      const user = await getUserById(db, existing.id);

      const otpCode = generateOtp();
      const otpCodeHash = createOtpVerificationCodeHash(otpCode);
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

      await createEmailVerificationOtp(db, {
        userId: user.id,
        email: normalizedEmail,
        codeHash: otpCodeHash,
        expiresAt,
      });

      db.close();

      // Send verification email
      const emailResult = await sendVerificationEmail({
        to: normalizedEmail,
        otpCode,
        userName: user.name,
      });

      const verificationToken = jwtSignEmailVerificationToken(user.id, normalizedEmail);
      return res.json({
        ok: true,
        message: 'Registration code sent. Check your email to verify.',
        verificationRequired: true,
        verificationToken,
        // Only expose the raw code in dev mode (no email configured)
        ...(emailResult.devMode && { otpCode }),
      });
    }

    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const user = await createUser(db, {
      name: String(name).trim(),
      email: normalizedEmail,
      passwordHash,
      emailVerified: 0,
    });

    // Generate secure 6-digit OTP
    const otpCode = generateOtp();
    const otpCodeHash = createOtpVerificationCodeHash(otpCode);
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

    // Store OTP (hash only)
    await createEmailVerificationOtp(db, {
      userId: user.id,
      email: normalizedEmail,
      codeHash: otpCodeHash,
      expiresAt,
    });

    db.close();

    // Send verification email
    const emailResult = await sendVerificationEmail({
      to: normalizedEmail,
      otpCode,
      userName: user.name,
    });

    // Create a short-lived verification token
    const verificationToken = jwtSignEmailVerificationToken(user.id, normalizedEmail);

    return res.json({
      ok: true,
      message: 'Registration successful! Check your email for the verification code.',
      verificationRequired: true,
      verificationToken,
      // Only expose the raw code in dev mode (no email configured)
      ...(emailResult.devMode && { otpCode }),
    });
  } catch (err) {
    console.error('[register]', err);
    return res.status(500).json({ ok: false, error: 'Server error' });
  }
}

app.post('/api/auth/login', loginRateLimiter, async (req, res) => {
  try {
    const { email, password } = req.body || {};

    if (!email || !password) {
      return res.status(400).json({ ok: false, error: 'Email and password are required' });
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const db = openDb();
    const user = await getUserByEmail(db, normalizedEmail);

    if (!user) {
      db.close();
      return res.status(401).json({ ok: false, error: 'Invalid credentials' });
    }

    // Reject unverified accounts
    if (user.email_verified !== 1) {
      db.close();
      return res.status(403).json({ ok: false, error: 'Email verification required' });
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      db.close();
      return res.status(401).json({ ok: false, error: 'Invalid credentials' });
    }

    db.close();
    resetLoginAttempts(req);
    const accessToken = await issueTokens(res, user);
    const logDb = openDb();
    await updateUserLastLogin(logDb, user.id);
    if (user.role === 'admin') {
      await updateAdminLastLogin(logDb, user.id);
      await logActivity(logDb, user.id, 'admin_login', `Admin ${user.email} logged in`);
    }
    logDb.close();
    return res.json({ ok: true, user: publicUser(user), accessToken });
  } catch {
    return res.status(500).json({ ok: false, error: 'Server error' });
  }
});

app.post('/api/auth/refresh', async (req, res) => {
  try {
    const refreshToken = req.cookies?.ceylon_refresh;
    if (!refreshToken) {
      return res.status(401).json({ ok: false, error: 'No refresh token' });
    }

    let payload;
    try {
      payload = verifyRefreshToken(refreshToken);
    } catch {
      clearRefreshCookie(res);
      return res.status(401).json({ ok: false, error: 'Invalid refresh token' });
    }

    const db = openDb();
    const stored = await getRefreshToken(db, hashToken(refreshToken));

    if (!stored || stored.user_id !== payload.sub) {
      db.close();
      clearRefreshCookie(res);
      return res.status(401).json({ ok: false, error: 'Refresh token revoked' });
    }

    const user = await getUserById(db, payload.sub);
    db.close();

    if (!user) {
      clearRefreshCookie(res);
      return res.status(401).json({ ok: false, error: 'User not found' });
    }

    const accessToken = await issueTokens(res, user);
    return res.json({ ok: true, accessToken, user: publicUser(user) });
  } catch {
    return res.status(500).json({ ok: false, error: 'Server error' });
  }
});

app.post('/api/auth/change-password', requireAuth, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body || {};
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ ok: false, error: 'Current and new password are required' });
    }
    if (String(newPassword).length < 8) {
      return res.status(400).json({ ok: false, error: 'New password must be at least 8 characters' });
    }
    const db = openDb();
    const user = await getUserById(db, req.user.id);
    if (!user) { db.close(); return res.status(404).json({ ok: false, error: 'User not found' }); }
    const valid = await bcrypt.compare(currentPassword, user.password_hash);
    if (!valid) { db.close(); return res.status(401).json({ ok: false, error: 'Current password is incorrect' }); }
    const newHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
    await run(db, 'UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?', [newHash, new Date().toISOString(), user.id]);
    db.close();
    return res.json({ ok: true, message: 'Password changed successfully' });
  } catch (err) {
    return res.status(500).json({ ok: false, error: 'Server error' });
  }
});

app.post('/api/auth/logout', async (req, res) => {
  try {
    const refreshToken = req.cookies?.ceylon_refresh;
    if (refreshToken) {
      const db = openDb();
      await deleteRefreshToken(db, hashToken(refreshToken));
      db.close();
    }
    clearRefreshCookie(res);
    return res.json({ ok: true });
  } catch {
    clearRefreshCookie(res);
    return res.json({ ok: true });
  }
});

app.post('/api/upload/images', requireAuth, (req, res) => {
  if (!upload) {
    return res.status(503).json({
      ok: false,
      error: 'Cloudinary is not configured. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET.',
    });
  }

  upload.array('images', 10)(req, res, async (err) => {
    if (err) {
      return res.status(400).json({ ok: false, error: err.message || 'Upload failed' });
    }

    try {
      const urls = await uploadFilesToCloudinary(req.files || []);
      return res.json({ ok: true, urls });
    } catch (uploadErr) {
      return res.status(500).json({ ok: false, error: uploadErr.message || 'Upload failed' });
    }
  });
});

app.get('/api/ads', async (_req, res) => {
  try {
    const db = openDb();
    const ads = await getAllActiveAds(db);
    db.close();
    return res.json({ ok: true, ads });
  } catch {
    return res.status(500).json({ ok: false, error: 'Server error' });
  }
});

app.get('/api/ads/:id', async (req, res) => {
  try {
    const db = openDb();
    const ad = await getAdById(db, req.params.id);
    db.close();

    if (!ad) {
      return res.status(404).json({ ok: false, error: 'Ad not found' });
    }

    if (ad.status !== 'active' && ad.publisherId !== req.user?.id) {
      return res.status(404).json({ ok: false, error: 'Ad not found' });
    }

    return res.json({ ok: true, ad });
  } catch {
    return res.status(500).json({ ok: false, error: 'Server error' });
  }
});

app.post('/api/ads', requireAuth, async (req, res) => {
  try {
    const body = req.body || {};
    const engineCapacity = Number(body.engineCapacity);

    if (!engineCapacity || engineCapacity <= 250) {
      return res.status(400).json({ ok: false, error: 'Engine capacity must be greater than 250cc.' });
    }

    const required = ['type', 'make', 'model', 'year', 'price', 'location', 'engine', 'description', 'sellerName', 'sellerPhone', 'sellerEmail'];
    for (const field of required) {
      if (!body[field] && body[field] !== 0) {
        return res.status(400).json({ ok: false, error: `${field} is required` });
      }
    }

    const images = Array.isArray(body.images) ? body.images : [];
    if (images.length === 0) {
      return res.status(400).json({ ok: false, error: 'At least one image is required' });
    }

    const ad = {
      id: `cs-custom-${Date.now()}`,
      title: `${body.make} ${body.model} ${body.year}`,
      type: body.type,
      make: body.make,
      model: body.model,
      year: Number(body.year),
      price: Number(body.price),
      location: body.location,
      mileage: Number(body.mileage) || 0,
      transmission: body.transmission || 'Automatic',
      fuel: body.fuel || 'Petrol',
      engine: body.engine,
      engineCapacity,
      power: body.power || '',
      topSpeed: body.topSpeed ? Number(body.topSpeed) : null,
      zeroToHundred: body.zeroToHundred || '',
      condition: body.condition || 'Registered',
      dutyStatus: body.dutyStatus || 'Duty Paid',
      sellerName: body.sellerName,
      sellerPhone: body.sellerPhone,
      sellerEmail: body.sellerEmail,
      description: body.description,
      images,
      publisherId: req.user.id,
      status: 'pending_payment',
      dateAdded: new Date().toISOString().split('T')[0],
      featured: false,
    };

    const db = openDb();
    await createAd(db, ad);
    db.close();

    return res.status(201).json({ ok: true, ad });
  } catch {
    return res.status(500).json({ ok: false, error: 'Server error' });
  }
});

app.delete('/api/ads/:id', requireAuth, async (req, res) => {
  try {
    const db = openDb();
    const ad = await getAdById(db, req.params.id);

    if (!ad) {
      db.close();
      return res.status(404).json({ ok: false, error: 'Ad not found' });
    }

    if (ad.publisherId !== req.user.id) {
      db.close();
      return res.status(403).json({ ok: false, error: 'Forbidden' });
    }

    await deleteAd(db, req.params.id);
    db.close();
    return res.json({ ok: true });
  } catch {
    return res.status(500).json({ ok: false, error: 'Server error' });
  }
});

app.get('/api/spare-parts', async (_req, res) => {
  try {
    const db = openDb();
    const parts = await getAllSpareParts(db);
    db.close();
    return res.json({ ok: true, spareParts: parts });
  } catch {
    return res.status(500).json({ ok: false, error: 'Server error' });
  }
});

app.post('/api/spare-parts', requireAuth, async (req, res) => {
  try {
    const body = req.body || {};
    const images = Array.isArray(body.images) ? body.images : [];

    if (images.length === 0) {
      return res.status(400).json({ ok: false, error: 'At least one image is required' });
    }

    const part = {
      id: `spare-${Date.now()}`,
      name: body.name,
      category: body.category,
      compatible: body.compatible,
      condition: body.condition,
      price: Number(body.price),
      location: body.location,
      sellerName: body.sellerName,
      sellerPhone: body.sellerPhone,
      description: body.description,
      images,
      publisherId: req.user.id,
      dateAdded: new Date().toISOString().split('T')[0],
    };

    const db = openDb();
    await createSparePart(db, part);
    db.close();

    return res.status(201).json({ ok: true, sparePart: part });
  } catch {
    return res.status(500).json({ ok: false, error: 'Server error' });
  }
});

app.delete('/api/spare-parts/:id', requireAuth, async (req, res) => {
  try {
    const db = openDb();
    const part = await getSparePartById(db, req.params.id);

    if (!part) {
      db.close();
      return res.status(404).json({ ok: false, error: 'Spare part not found' });
    }

    if (part.publisherId !== req.user.id) {
      db.close();
      return res.status(403).json({ ok: false, error: 'Forbidden' });
    }

    await deleteSparePart(db, req.params.id);
    db.close();
    return res.json({ ok: true });
  } catch {
    return res.status(500).json({ ok: false, error: 'Server error' });
  }
});

app.post('/api/payment/create-intent', requireAuth, async (req, res) => {
  try {
    if (!stripe) {
      return res.status(503).json({ ok: false, error: 'Stripe is not configured' });
    }

    const { adId } = req.body || {};
    if (!adId) {
      return res.status(400).json({ ok: false, error: 'adId is required' });
    }

    const db = openDb();
    const ad = await getAdById(db, adId);
    db.close();

    if (!ad) {
      return res.status(404).json({ ok: false, error: 'Ad not found' });
    }

    if (ad.publisherId !== req.user.id) {
      return res.status(403).json({ ok: false, error: 'Forbidden' });
    }

    if (ad.status === 'active') {
      return res.status(400).json({ ok: false, error: 'Ad is already active' });
    }

    const paymentIntent = await stripe.paymentIntents.create({
      amount: AD_POSTING_FEE,
      currency: AD_CURRENCY,
      metadata: { adId, userId: String(req.user.id) },
      automatic_payment_methods: { enabled: true },
    });

    return res.json({
      ok: true,
      clientSecret: paymentIntent.client_secret,
      amount: AD_POSTING_FEE,
      currency: AD_CURRENCY,
    });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message || 'Payment error' });
  }
});

app.post('/api/payment/confirm', requireAuth, async (req, res) => {
  try {
    if (!stripe) {
      return res.status(503).json({ ok: false, error: 'Stripe is not configured' });
    }

    const { paymentIntentId } = req.body || {};
    if (!paymentIntentId) {
      return res.status(400).json({ ok: false, error: 'paymentIntentId is required' });
    }

    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

    if (paymentIntent.status !== 'succeeded') {
      return res.status(400).json({ ok: false, error: 'Payment not completed' });
    }

    const adId = paymentIntent.metadata?.adId;
    if (!adId) {
      return res.status(400).json({ ok: false, error: 'Invalid payment metadata' });
    }

    const db = openDb();
    const ad = await getAdById(db, adId);

    if (!ad || ad.publisherId !== req.user.id) {
      db.close();
      return res.status(403).json({ ok: false, error: 'Forbidden' });
    }

    await updateAdStatus(db, adId, 'active');
    const updatedAd = await getAdById(db, adId);
    db.close();

    return res.json({ ok: true, ad: updatedAd });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message || 'Payment confirmation error' });
  }
});

// ── Admin API Routes ─────────────────────────────────────────────
app.get('/api/admin/dashboard', requireAdmin, async (_req, res) => {
  try {
    const db = openDb();
    const stats = await getDashboardStats(db);
    const revenueData = await getMonthlyRevenueData(db);
    const userData = await getMonthlyUserData(db);
    const adData = await getMonthlyAdData(db);
    const activities = await getRecentActivities(db, 10);
    db.close();
    return res.json({ ok: true, stats, revenueData, userData, adData, activities });
  } catch (err) {
    return res.status(500).json({ ok: false, error: 'Server error' });
  }
});

app.get('/api/admin/users', requireAdmin, async (req, res) => {
  try {
    const db = openDb();
    const search = req.query.search || '';
    const sort = req.query.sort || '';
    const filter = req.query.filter || '';
    const users = await getAllUsers(db, { search, sort, filter });
    const usersWithAdCount = await Promise.all(users.map(async (u) => {
      const adCount = await getUserAdCount(db, u.id);
      return { ...u, totalAds: adCount };
    }));
    db.close();
    return res.json({ ok: true, users: usersWithAdCount });
  } catch (err) {
    return res.status(500).json({ ok: false, error: 'Server error' });
  }
});

app.post('/api/admin/user/disable', requireAdmin, async (req, res) => {
  try {
    const { userId } = req.body || {};
    if (!userId) return res.status(400).json({ ok: false, error: 'userId is required' });
    const db = openDb();
    await updateUserStatus(db, userId, 'disabled');
    await logActivity(db, req.user.id, 'user_disabled', `User ${userId} disabled by admin ${req.user.email}`);
    db.close();
    return res.json({ ok: true, message: 'User disabled' });
  } catch (err) {
    return res.status(500).json({ ok: false, error: 'Server error' });
  }
});

app.post('/api/admin/user/enable', requireAdmin, async (req, res) => {
  try {
    const { userId } = req.body || {};
    if (!userId) return res.status(400).json({ ok: false, error: 'userId is required' });
    const db = openDb();
    await updateUserStatus(db, userId, 'active');
    await logActivity(db, req.user.id, 'user_enabled', `User ${userId} enabled by admin ${req.user.email}`);
    db.close();
    return res.json({ ok: true, message: 'User enabled' });
  } catch (err) {
    return res.status(500).json({ ok: false, error: 'Server error' });
  }
});

app.delete('/api/admin/user/:id', requireAdmin, async (req, res) => {
  try {
    const userId = req.params.id;
    const db = openDb();
    await deleteUserById(db, userId);
    await logActivity(db, req.user.id, 'user_deleted', `User ${userId} deleted by admin ${req.user.email}`);
    db.close();
    return res.json({ ok: true, message: 'User deleted' });
  } catch (err) {
    return res.status(500).json({ ok: false, error: 'Server error' });
  }
});

app.get('/api/admin/listings', requireAdmin, async (req, res) => {
  try {
    const db = openDb();
    const search = req.query.search || '';
    const filter = req.query.filter || '';
    const listings = await getAllAds(db, { search, filter });
    db.close();
    return res.json({ ok: true, listings });
  } catch (err) {
    return res.status(500).json({ ok: false, error: 'Server error' });
  }
});

app.post('/api/admin/listing/approve', requireAdmin, async (req, res) => {
  try {
    const { adId } = req.body || {};
    if (!adId) return res.status(400).json({ ok: false, error: 'adId is required' });
    const db = openDb();
    const ad = await getAdById(db, adId);
    if (!ad) { db.close(); return res.status(404).json({ ok: false, error: 'Ad not found' }); }
    await updateAdStatus(db, adId, 'active');
    await logActivity(db, req.user.id, 'ad_approved', `Ad ${adId} approved by admin ${req.user.email}`);
    db.close();
    return res.json({ ok: true, message: 'Listing approved' });
  } catch (err) {
    return res.status(500).json({ ok: false, error: 'Server error' });
  }
});

app.post('/api/admin/listing/reject', requireAdmin, async (req, res) => {
  try {
    const { adId } = req.body || {};
    if (!adId) return res.status(400).json({ ok: false, error: 'adId is required' });
    const db = openDb();
    const ad = await getAdById(db, adId);
    if (!ad) { db.close(); return res.status(404).json({ ok: false, error: 'Ad not found' }); }
    await updateAdStatus(db, adId, 'rejected');
    await logActivity(db, req.user.id, 'ad_rejected', `Ad ${adId} rejected by admin ${req.user.email}`);
    db.close();
    return res.json({ ok: true, message: 'Listing rejected' });
  } catch (err) {
    return res.status(500).json({ ok: false, error: 'Server error' });
  }
});

app.post('/api/admin/listing/feature', requireAdmin, async (req, res) => {
  try {
    const { adId } = req.body || {};
    if (!adId) return res.status(400).json({ ok: false, error: 'adId is required' });
    const db = openDb();
    const ad = await getAdById(db, adId);
    if (!ad) { db.close(); return res.status(404).json({ ok: false, error: 'Ad not found' }); }
    await updateAdFeatured(db, adId, true);
    await logActivity(db, req.user.id, 'ad_featured', `Ad ${adId} featured by admin ${req.user.email}`);
    db.close();
    return res.json({ ok: true, message: 'Listing marked as featured' });
  } catch (err) {
    return res.status(500).json({ ok: false, error: 'Server error' });
  }
});

app.post('/api/admin/listing/unfeature', requireAdmin, async (req, res) => {
  try {
    const { adId } = req.body || {};
    if (!adId) return res.status(400).json({ ok: false, error: 'adId is required' });
    const db = openDb();
    const ad = await getAdById(db, adId);
    if (!ad) { db.close(); return res.status(404).json({ ok: false, error: 'Ad not found' }); }
    await updateAdFeatured(db, adId, false);
    await logActivity(db, req.user.id, 'ad_unfeatured', `Ad ${adId} unfeatured by admin ${req.user.email}`);
    db.close();
    return res.json({ ok: true, message: 'Featured removed' });
  } catch (err) {
    return res.status(500).json({ ok: false, error: 'Server error' });
  }
});

app.delete('/api/admin/listing/:id', requireAdmin, async (req, res) => {
  try {
    const adId = req.params.id;
    const db = openDb();
    const ad = await getAdById(db, adId);
    if (!ad) { db.close(); return res.status(404).json({ ok: false, error: 'Ad not found' }); }
    await deleteAd(db, adId);
    await logActivity(db, req.user.id, 'ad_deleted', `Ad ${adId} deleted by admin ${req.user.email}`);
    db.close();
    return res.json({ ok: true, message: 'Listing deleted' });
  } catch (err) {
    return res.status(500).json({ ok: false, error: 'Server error' });
  }
});

app.get('/api/admin/pending', requireAdmin, async (_req, res) => {
  try {
    const db = openDb();
    const listings = await getPendingAds(db);
    db.close();
    return res.json({ ok: true, listings });
  } catch (err) {
    return res.status(500).json({ ok: false, error: 'Server error' });
  }
});

app.get('/api/admin/featured', requireAdmin, async (_req, res) => {
  try {
    const db = openDb();
    const listings = await getFeaturedAds(db);
    db.close();
    return res.json({ ok: true, listings });
  } catch (err) {
    return res.status(500).json({ ok: false, error: 'Server error' });
  }
});

app.get('/api/admin/revenue', requireAdmin, async (_req, res) => {
  try {
    const db = openDb();
    const stats = await getRevenueStats(db);
    const payments = await getRecentPayments(db, 50);
    const revenueData = await getMonthlyRevenueData(db);
    db.close();
    return res.json({ ok: true, stats, payments, revenueData });
  } catch (err) {
    return res.status(500).json({ ok: false, error: 'Server error' });
  }
});

app.get('/api/admin/admins', requireAdmin, async (_req, res) => {
  try {
    const db = openDb();
    const admins = await getAllAdmins(db);
    db.close();
    return res.json({ ok: true, admins });
  } catch (err) {
    return res.status(500).json({ ok: false, error: 'Server error' });
  }
});

app.use(express.static(ROOT_DIR));
app.get('*', (_req, res) => {
  res.sendFile(path.join(ROOT_DIR, 'main.html'));
});

const PORT = process.env.PORT ? Number(process.env.PORT) : 3001;

initSchema()
  .then(async () => {
    const db = openDb();
    await seedPreloadedAds(db, PRELOADED_ADS);
    db.close();

    app.listen(PORT, () => {
      console.log(`[ceylonsuperhub] Server running on http://localhost:${PORT}`);
      if (!isCloudinaryConfigured()) {
        console.warn('[ceylonsuperhub] Cloudinary not configured — image uploads will fail until env vars are set.');
      }
      if (!stripe) {
        console.warn('[ceylonsuperhub] Stripe not configured — payments disabled until STRIPE_SECRET_KEY is set.');
      }
    });
  })
  .catch((e) => {
    console.error('Failed to init DB', e);
    process.exit(1);
  });
