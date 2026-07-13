const jwt = require('jsonwebtoken');

const ACCESS_SECRET = process.env.JWT_SECRET || 'local-dev-access-secret-change-me';
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'local-dev-refresh-secret-change-me';

const ACCESS_EXPIRY = '15m';
const REFRESH_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000;

function signAccessToken(user) {
  return jwt.sign(
    { sub: user.id, email: user.email, role: user.role || 'user' },
    ACCESS_SECRET,
    { expiresIn: ACCESS_EXPIRY }
  );
}

function signRefreshToken(user) {
  return jwt.sign({ sub: user.id, type: 'refresh' }, REFRESH_SECRET, { expiresIn: '7d' });
}

function verifyAccessToken(token) {
  return jwt.verify(token, ACCESS_SECRET);
}

function verifyRefreshToken(token) {
  return jwt.verify(token, REFRESH_SECRET);
}

function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ ok: false, error: 'Unauthorized' });
  }

  try {
    const payload = verifyAccessToken(token);
    req.user = { id: payload.sub, email: payload.email, role: payload.role };
    return next();
  } catch {
    return res.status(401).json({ ok: false, error: 'Invalid or expired token' });
  }
}

function requireAnyAdmin(req, res, next) {
  if (!req.user) return res.status(401).json({ ok: false, error: 'Unauthorized' });
  if (req.user.role === 'admin' || req.user.role === 'super_admin') return next();
  return res.status(403).json({ ok: false, error: 'Forbidden: admin access required' });
}

function requireSuperAdmin(req, res, next) {
  if (!req.user) return res.status(401).json({ ok: false, error: 'Unauthorized' });
  if (req.user.role === 'super_admin') return next();
  return res.status(403).json({ ok: false, error: 'Forbidden: super_admin access required' });
}

function optionalAuth(req, _res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (token) {
    try {
      const payload = verifyAccessToken(token);
      req.user = { id: payload.sub, email: payload.email, role: payload.role };
    } catch {
      req.user = null;
    }
  }

  next();
}

module.exports = {
  ACCESS_SECRET,
  REFRESH_SECRET,
  REFRESH_EXPIRY_MS,
  signAccessToken,
  signRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  requireAuth,
  requireAnyAdmin,
  requireSuperAdmin,
  optionalAuth,
};
