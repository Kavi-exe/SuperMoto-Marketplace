const jwt = require('jsonwebtoken');

const ACCESS_SECRET = process.env.JWT_SECRET || 'local-dev-access-secret-change-me';

function requireAdmin(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ ok: false, error: 'Unauthorized' });
  }

  try {
    const payload = jwt.verify(token, ACCESS_SECRET);
    
    if (!payload.sub || !payload.role || payload.role !== 'admin') {
      return res.status(403).json({ ok: false, error: 'Forbidden: Admin access required' });
    }
    
    req.user = { id: payload.sub, email: payload.email, role: payload.role };
    return next();
  } catch {
    return res.status(401).json({ ok: false, error: 'Invalid or expired token' });
  }
}

module.exports = {
  requireAdmin,
};