const loginAttempts = new Map();
const otpAttempts = new Map();

const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 5;
const MAX_OTP_ATTEMPTS = 10;

function getClientIp(req) {
  return req.ip || req.connection?.remoteAddress || 'unknown';
}

function loginRateLimiter(req, res, next) {
  const ip = getClientIp(req);
  const now = Date.now();
  let record = loginAttempts.get(ip);

  if (!record || now - record.windowStart > WINDOW_MS) {
    record = { windowStart: now, count: 0 };
    loginAttempts.set(ip, record);
  }

  if (record.count >= MAX_ATTEMPTS) {
    const retryAfter = Math.ceil((record.windowStart + WINDOW_MS - now) / 1000);
    res.set('Retry-After', String(retryAfter));
    return res.status(429).json({
      ok: false,
      error: 'Too many login attempts. Please try again in 15 minutes.',
    });
  }

  record.count += 1;
  next();
}

function otpVerifyRateLimiter(req, res, next) {
  const ip = getClientIp(req);
  const now = Date.now();
  let record = otpAttempts.get(ip);

  if (!record || now - record.windowStart > WINDOW_MS) {
    record = { windowStart: now, count: 0 };
    otpAttempts.set(ip, record);
  }

  if (record.count >= MAX_OTP_ATTEMPTS) {
    const retryAfter = Math.ceil((record.windowStart + WINDOW_MS - now) / 1000);
    res.set('Retry-After', String(retryAfter));
    return res.status(429).json({
      ok: false,
      error: 'Too many verification attempts. Please try again in 15 minutes.',
    });
  }

  record.count += 1;
  next();
}

function resetLoginAttempts(req) {
  loginAttempts.delete(getClientIp(req));
}

function pruneExpired() {
  const now = Date.now();
  for (const [ip, record] of loginAttempts) {
    if (now - record.windowStart > WINDOW_MS) loginAttempts.delete(ip);
  }
  for (const [ip, record] of otpAttempts) {
    if (now - record.windowStart > WINDOW_MS) otpAttempts.delete(ip);
  }
}

setInterval(pruneExpired, WINDOW_MS).unref();

module.exports = { loginRateLimiter, otpVerifyRateLimiter, resetLoginAttempts };
