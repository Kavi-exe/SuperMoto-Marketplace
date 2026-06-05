const express = require('express');
const session = require('express-session');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const bcrypt = require('bcrypt');
const crypto = require('crypto');

const { openDb, initSchema, getUserByEmail, getUserById } = require('./database');

const app = express();

// You should run backend + frontend from the same origin for cookies,
// but allow local dev from file:// / other ports.
app.use(
  cors({
    origin: true,
    credentials: true,
  })
);

app.use(cookieParser());
app.use(express.json({ limit: '2mb' }));

// Cookie-based session (HTTP-only)
app.use(
  session({
    name: 'ceylon_session',
    secret: process.env.SESSION_SECRET || 'local-dev-secret-change-me',
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      secure: false, // local dev
      maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days
    },
  })
);

async function ensureDb() {
  await initSchema();
}

function requireAuth(req, res, next) {
  if (req.session && req.session.userId) return next();
  return res.status(401).json({ ok: false, error: 'Unauthorized' });
}

app.get('/api/auth/me', async (req, res) => {
  try {
    const userId = req.session?.userId;
    if (!userId) return res.json({ ok: true, user: null });

    const db = openDb();
    const user = await getUserById(db, userId);
    db.close();

    if (!user) {
      req.session.userId = null;
      return res.json({ ok: true, user: null });
    }

    return res.json({
      ok: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
      },
    });
  } catch (e) {
    return res.status(500).json({ ok: false, error: 'Server error' });
  }
});

app.post('/api/auth/signup', async (req, res) => {
  try {
    const { name, email, password } = req.body || {};

    if (!name || !email || !password) {
      return res.status(400).json({ ok: false, error: 'name, email, password are required' });
    }

    if (String(password).length < 8) {
      return res.status(400).json({ ok: false, error: 'Password must be at least 8 characters' });
    }

    const normalizedEmail = String(email).trim().toLowerCase();

    const db = openDb();
    const existing = await getUserByEmail(db, normalizedEmail);
    if (existing) {
      db.close();
      return res.status(409).json({ ok: false, error: 'Email already in use' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const createdAt = new Date().toISOString();

    await new Promise((resolve, reject) => {
      db.run(
        'INSERT INTO users (name, email, password_hash, created_at) VALUES (?, ?, ?, ?)',
        [name, normalizedEmail, passwordHash, createdAt],
        function (err) {
          if (err) return reject(err);
          resolve(this);
        }
      );
    });

    // Get last inserted id
    const user = await getUserByEmail(db, normalizedEmail);
    db.close();

    req.session.userId = user.id;

    return res.json({ ok: true, user: { id: user.id, name: user.name, email: user.email } });
  } catch (e) {
    return res.status(500).json({ ok: false, error: 'Server error' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ ok: false, error: 'email and password are required' });
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const db = openDb();
    const user = await getUserByEmail(db, normalizedEmail);
    if (!user) {
      db.close();
      return res.status(401).json({ ok: false, error: 'Invalid credentials' });
    }

    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) {
      db.close();
      return res.status(401).json({ ok: false, error: 'Invalid credentials' });
    }

    db.close();
    req.session.userId = user.id;

    return res.json({ ok: true, user: { id: user.id, name: user.name, email: user.email } });
  } catch (e) {
    return res.status(500).json({ ok: false, error: 'Server error' });
  }
});

app.post('/api/auth/google', async (req, res) => {
  try {
    const { name, email } = req.body || {};
    if (!name || !email) {
      return res.status(400).json({ ok: false, error: 'name and email are required' });
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const db = openDb();

    // Check if user exists
    let user = await getUserByEmail(db, normalizedEmail);
    if (!user) {
      // Create user with a secure random password since it is a NOT NULL database column
      const passwordHash = await bcrypt.hash(crypto.randomBytes(16).toString('hex'), 10);
      const createdAt = new Date().toISOString();

      await new Promise((resolve, reject) => {
        db.run(
          'INSERT INTO users (name, email, password_hash, created_at) VALUES (?, ?, ?, ?)',
          [name, normalizedEmail, passwordHash, createdAt],
          function (err) {
            if (err) return reject(err);
            resolve(this);
          }
        );
      });

      user = await getUserByEmail(db, normalizedEmail);
    }

    db.close();
    req.session.userId = user.id;

    return res.json({ ok: true, user: { id: user.id, name: user.name, email: user.email } });
  } catch (e) {
    return res.status(500).json({ ok: false, error: 'Server error' });
  }
});

app.post('/api/auth/logout', (req, res) => {
  try {
    req.session.destroy(() => {
      res.json({ ok: true });
    });
  } catch {
    res.json({ ok: true });
  }
});

const PORT = process.env.PORT ? Number(process.env.PORT) : 3001;

ensureDb()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`[ceylon-auth] Server running on http://localhost:${PORT}`);
    });
  })
  .catch((e) => {
    console.error('Failed to init DB', e);
    process.exit(1);
  });

