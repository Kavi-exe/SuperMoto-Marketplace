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
    initSchema,
    getUserByEmail,
    getUserById,
    createUser,
    updateUser,
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
    getAdmins,
    getAdminByUserId,
    createAdminRecord,
    updateAdminLastLogin,
    deleteAdminRecord,
  } = require('./database');

const {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
  requireAuth,
  REFRESH_EXPIRY_MS,
} = require('./middleware/auth');

const { loginRateLimiter, otpVerifyRateLimiter, resetLoginAttempts } = require('./middleware/rateLimit');
const { requireAdmin } = require('./middleware/admin');
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
  await updateUser(db, user.id, { last_login: new Date().toISOString() });
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

// ── ADMIN ENDPOINTS ─────────────────────────────────────────────────────

// Dashboard
app.get('/admin/dashboard', requireAuth, requireAdmin, async (req, res) => {
  try {
    const db = openDb();
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    const startOfYear = new Date(now.getFullYear(), 0, 1).toISOString().split('T')[0];

    // Statistics
    const [totalRevenueRows, totalUsersRows, activeAdsRows, pendingAdsRows, featuredAdsRows] = await Promise.all([
      all(db, "SELECT SUM(CASE WHEN status = 'active' THEN price ELSE 0 END) as revenue FROM ads"),
      all(db, "SELECT COUNT(*) as count FROM users WHERE status = 'active'"),
      all(db, "SELECT COUNT(*) as count FROM ads WHERE status = 'active' AND featured = 1"),
      all(db, "SELECT COUNT(*) as count FROM ads WHERE status = 'pending_payment' OR status = 'pending'"),
      all(db, "SELECT COUNT(*) as count FROM ads WHERE featured = 1 AND status = 'active'"),
    ]);

    db.close();

    const dashboardStats = {
      totalRevenue: totalRevenueRows[0]?.revenue || 0,
      totalUsers: totalUsersRows[0]?.count || 0,
      activeAds: activeAdsRows[0]?.count || 0,
      pendingAds: pendingAdsRows[0]?.count || 0,
      featuredAds: featuredAdsRows[0]?.count || 0,
    };

    return res.json({ ok: true, stats: dashboardStats });
  } catch (err) {
    console.error('[admin-dashboard]', err);
    return res.status(500).json({ ok: false, error: 'Server error' });
  }
});

// Users Management
app.get('/admin/users', requireAuth, requireAdmin, async (req, res) => {
  try {
    const db = openDb();
    const rows = await all(db, 'SELECT * FROM users WHERE role = ?', ['user']);
    db.close();

    const users = rows.map((row) => ({...
      id: row.id,
      name: row.name,
      email: row.email,
      role: row.role,
      email_verified: row.email_verified,
      status: row.status || 'active',
      created_at: row.created_at,
      updated_at: row.updated_at,
      last_login: row.last_login,
    }));

    return res.json({ ok: true, users });
  } catch (err) {
    console.error('[admin-users]', err);
    return res.status(500).json({ ok: false, error: 'Server error' });
  }
});

app.post('/admin/user/disable', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { userId } = req.body || {};
    if (!userId) {
      return res.status(400).json({ ok: false, error: 'User ID is required' });
    }

    const db = openDb();
    await updateUser(db, userId, { status: 'disabled' });
    db.close();

    return res.json({ ok: true, message: 'User disabled successfully' });
  } catch (err) {
    console.error('[admin-user-disable]', err);
    return res.status(500).json({ ok: false, error: 'Server error' });
  }
});

app.post('/admin/user/enable', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { userId } = req.body || {};
    if (!userId) {
      return res.status(400).json({ ok: false, error: 'User ID is required' });
    }

    const db = openDb();
    await updateUser(db, userId, { status: 'active' });
    db.close();

    return res.json({ ok: true, message: 'User enabled successfully' });
  } catch (err) {
    console.error('[admin-user-enable]', err);
    return res.status(500).json({ ok: false, error: 'Server error' });
  }
});

app.delete('/admin/user/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const db = openDb();
    await deleteUserRefreshTokens(db, req.params.id);
    await run(db, 'DELETE FROM users WHERE id = ?', [req.params.id]);
    db.close();

    return res.json({ ok: true, message: 'User deleted successfully' });
  } catch (err) {
    console.error('[admin-user-delete]', err);
    return res.status(500).json({ ok: false, error: 'Server error' });
  }
});

// Listings Management
app.get('/admin/listings', requireAuth, requireAdmin, async (req, res) => {
  try {
    const db = openDb();
    const rows = await all(db, 'SELECT * FROM ads ORDER BY date_added DESC');
    db.close();

    const listings = rows.map((row) => ({...
      id: row.id,
      title: row.title,
      type: row.type,
      make: row.make,
      model: row.model,
      year: row.year,
      price: row.price,
      location: row.location,
      status: row.status,
      featured: Boolean(row.featured),
      date_added: row.date_added,
      publisher_id: row.publisher_id,
    }));

    return res.json({ ok: true, listings });
  } catch (err) {
    console.error('[admin-listings]', err);
    return res.status(500).json({ ok: false, error: 'Server error' });
  }
});

app.post('/admin/listing/approve', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { adId } = req.body || {};
    if (!adId) {
      return res.status(400).json({ ok: false, error: 'Ad ID is required' });
    }

    const db = openDb();
    await updateAdStatus(db, adId, 'active');
    await run(db, 'UPDATE ads SET status = ? WHERE id = ?', ['active', adId]);
    db.close();

    return res.json({ ok: true, message: 'Listing approved successfully' });
  } catch (err) {
    console.error('[admin-listing-approve]', err);
    return res.status(500).json({ ok: false, error: 'Server error' });
  }
});

app.post('/admin/listing/reject', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { adId } = req.body || {};
    if (!adId) {
      return res.status(400).json({ ok: false, error: 'Ad ID is required' });
    }

    const db = openDb();
    await run(db, 'UPDATE ads SET status = ? WHERE id = ?', ['rejected', adId]);
    db.close();

    return res.json({ ok: true, message: 'Listing rejected successfully' });
  } catch (err) {
    console.error('[admin-listing-reject]', err);
    return res.status(500).json({ ok: false, error: 'Server error' });
  }
});

app.delete('/admin/listing/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const db = openDb();
    await deleteAd(db, req.params.id);
    db.close();

    return res.json({ ok: true, message: 'Listing deleted successfully' });
  } catch (err) {
    console.error('[admin-listing-delete]', err);
    return res.status(500).json({ ok: false, error: 'Server error' });
  }
});

app.post('/admin/listing/feature', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { adId } = req.body || {};
    if (!adId) {
      return res.status(400).json({ ok: false, error: 'Ad ID is required' });
    }

    const db = openDb();
    await run(db, 'UPDATE ads SET featured = 1 WHERE id = ?', [adId]);
    db.close();

    return res.json({ ok: true, message: 'Listing featured successfully' });
  } catch (err) {
    console.error('[admin-listing-feature]', err);
    return res.status(500).json({ ok: false, error: 'Server error' });
  }
});

app.post('/admin/listing/unfeature', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { adId } = req.body || {};
    if (!adId) {
      return res.status(400).json({ ok: false, error: 'Ad ID is required' });
    }

    const db = openDb();
    await run(db, 'UPDATE ads SET featured = 0 WHERE id = ?', [adId]);
    db.close();

    return res.json({ ok: true, message: 'Featured removed successfully' });
  } catch (err) {
    console.error('[admin-listing-unfeature]', err);
    return res.status(500).json({ ok: false, error: 'Server error' });
  }
});

// Pending Approvals
app.get('/admin/pending', requireAuth, requireAdmin, async (req, res) => {
  try {
    const db = openDb();
    const rows = await all(db, "SELECT * FROM ads WHERE status = 'pending_payment' OR status = 'pending'");
    db.close();

    const pending = rows.map((row) => ({...
      id: row.id,
      title: row.title,
      type: row.type,
      make: row.make,
      model: row.model,
      year: row.year,
      price: row.price,
      location: row.location,
      date_added: row.date_added,
      publisher_id: row.publisher_id,
    }));

    return res.json({ ok: true, pending });
  } catch (err) {
    console.error('[admin-pending]', err);
    return res.status(500).json({ ok: false, error: 'Server error' });
  }
});

// Featured Listings
app.get('/admin/featured', requireAuth, requireAdmin, async (req, res) => {
  try {
    const db = openDb();
    const rows = await all(db, "SELECT a.*, u.name as seller_name, u.email as seller_email FROM ads a JOIN users u ON a.publisher_id = u.id WHERE a.featured = 1 AND a.status = 'active' ORDER BY a.date_added DESC");
    db.close();

    const featured = rows.map((row) => ({...
      id: row.id,
      title: row.title,
      type: row.type,
      make: row.make,
      model: row.model,
      year: row.year,
      price: row.price,
      location: row.location,
      date_added: row.date_added,
      seller_name: row.seller_name,
      seller_email: row.seller_email,
      publisher_id: row.publisher_id,
    }));

    return res.json({ ok: true, featured });
  } catch (err) {
    console.error('[admin-featured]', err);
    return res.status(500).json({ ok: false, error: 'Server error' });
  }
});

// Revenue Page
app.get('/admin/revenue', requireAuth, requireAdmin, async (req, res) => {
  try {
    const db = openDb();
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    const startOfWeek = new Date(now.setDate(now.getDate() - now.getDay())).toISOString().split('T')[0];
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    const startOfYear = new Date(now.getFullYear(), 0, 1).toISOString().split('T')[0];

    const [todayRevenueRows, weeklyRevenueRows, monthlyRevenueRows, yearlyRevenueRows, lifetimeRevenueRows] = await Promise.all([
      all(db, "SELECT SUM(price) as revenue FROM ads WHERE date_added = ? AND status = 'active'", [today]),
      all(db, "SELECT SUM(price) as revenue FROM ads WHERE date_added >= ? AND status = 'active'", [startOfWeek]),
      all(db, "SELECT SUM(price) as revenue FROM ads WHERE date_added >= ? AND status = 'active'", [startOfMonth]),
      all(db, "SELECT SUM(price) as revenue FROM ads WHERE date_added >= ? AND status = 'active'", [startOfYear]),
      all(db, "SELECT SUM(price) as revenue FROM ads WHERE status = 'active'"),
    ]);

    const recentPayments = await all(db, "SELECT a.id, a.title, a.price, a.date_added, u.name as seller_name FROM ads a JOIN users u ON a.publisher_id = u.id WHERE a.status = 'active' ORDER BY a.date_added DESC LIMIT 10");

    db.close();

    const revenueStats = {
      today: todayRevenueRows[0]?.revenue || 0,
      weekly: weeklyRevenueRows[0]?.revenue || 0,
      monthly: monthlyRevenueRows[0]?.revenue || 0,
      yearly: yearlyRevenueRows[0]?.revenue || 0,
      lifetime: lifetimeRevenueRows[0]?.revenue || 0,
    };

    return res.json({ ok: true, revenue: revenueStats, recentPayments });
  } catch (err) {
    console.error('[admin-revenue]', err);
    return res.status(500).json({ ok: false, error: 'Server error' });
  }
});

// Admins Management
app.get('/admin/admins', requireAuth, requireAdmin, async (req, res) => {
  try {
    const db = openDb();
    const admins = await getAdmins(db);
    db.close();

    return res.json({ ok: true, admins });
  } catch (err) {
    console.error('[admin-admins]', err);
    return res.status(500).json({ ok: false, error: 'Server error' });
  }
});

// Settings
app.get('/admin/settings', requireAuth, requireAdmin, async (req, res) => {
  try {
    const profile = {
      name: 'Admin User',
      email: 'admin@ceylonsuperhub.com',
      avatar: '',
      permissions: {
        users: 'read',
        listings: 'read',
        payments: 'read',
        settings: 'read',
      }
    };

    return res.json({ ok: true, profile });
  } catch (err) {
    console.error('[admin-settings]', err);
    return res.status(500).json({ ok: false, error: 'Server error' });
  }
});

app.post('/admin/settings/update-profile', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { name, email } = req.body || {};
    if (!name || !email) {
      return res.status(400).json({ ok: false, error: 'Name and email are required' });
    }

    const db = openDb();
    await updateUser(db, req.user.id, { name, email });
    db.close();

    return res.json({ ok: true, message: 'Profile updated successfully' });
  } catch (err) {
    console.error('[admin-update-profile]', err);
    return res.status(500).json({ ok: false, error: 'Server error' });
  }
});

app.post('/api/auth/logout', requireAuth, async (req, res) => {
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
