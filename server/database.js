const path = require('path');
const fs = require('fs');
const sqlite3 = require('sqlite3').verbose();

const DB_FILENAME = 'app.sqlite';
const DB_DIR = path.join(__dirname, 'data');
const DB_PATH = path.join(DB_DIR, DB_FILENAME);

function ensureDbDir() {
  if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR, { recursive: true });
  }
}

function openDb() {
  ensureDbDir();
  return new sqlite3.Database(DB_PATH);
}

function run(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) return reject(err);
      resolve(this);
    });
  });
}

function get(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) return reject(err);
      resolve(row);
    });
  });
}

function all(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) return reject(err);
      resolve(rows || []);
    });
  });
}

async function initSchema() {
  const db = openDb();

  await run(
    db,
    `CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'user',
      email_verified INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    )`
  );

  await run(
    db,
    `CREATE TABLE IF NOT EXISTS refresh_tokens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      token_hash TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )`
  );

  await run(
    db,
    `CREATE TABLE IF NOT EXISTS email_verification_otps (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      email TEXT NOT NULL,
      code_hash TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL,
      used_at TEXT,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )`
  );

  await run(
    db,
    `CREATE TABLE IF NOT EXISTS ads (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      type TEXT NOT NULL,
      make TEXT NOT NULL,
      model TEXT NOT NULL,
      year INTEGER NOT NULL,
      price INTEGER NOT NULL,
      location TEXT NOT NULL,
      mileage INTEGER NOT NULL DEFAULT 0,
      transmission TEXT NOT NULL,
      fuel TEXT NOT NULL,
      engine TEXT NOT NULL,
      engine_capacity INTEGER NOT NULL,
      power TEXT,
      top_speed INTEGER,
      zero_to_hundred TEXT,
      condition TEXT NOT NULL,
      duty_status TEXT NOT NULL,
      seller_name TEXT NOT NULL,
      seller_phone TEXT NOT NULL,
      seller_email TEXT NOT NULL,
      description TEXT NOT NULL,
      images TEXT NOT NULL DEFAULT '[]',
      publisher_id INTEGER,
      status TEXT NOT NULL DEFAULT 'active',
      date_added TEXT NOT NULL,
      featured INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (publisher_id) REFERENCES users(id)
    )`
  );

  await run(
    db,
    `CREATE TABLE IF NOT EXISTS spare_parts (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      compatible TEXT NOT NULL,
      condition TEXT NOT NULL,
      price INTEGER NOT NULL,
      location TEXT NOT NULL,
      seller_name TEXT NOT NULL,
      seller_phone TEXT NOT NULL,
      description TEXT NOT NULL,
      images TEXT NOT NULL DEFAULT '[]',
      publisher_id INTEGER NOT NULL,
      date_added TEXT NOT NULL,
      FOREIGN KEY (publisher_id) REFERENCES users(id)
    )`
  );

  await migrateSchema(db);

  db.close();
}

async function migrateSchema(db) {
  const userColumns = await all(db, 'PRAGMA table_info(users)');
  const colNames = new Set(userColumns.map((c) => c.name));

  if (!colNames.has('role')) {
    await run(db, "ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'user'");
  }

  if (!colNames.has('email_verified')) {
    await run(db, "ALTER TABLE users ADD COLUMN email_verified INTEGER NOT NULL DEFAULT 0");
  }

  if (!colNames.has('verification_failed_attempts')) {
    await run(db, "ALTER TABLE users ADD COLUMN verification_failed_attempts INTEGER NOT NULL DEFAULT 0");
  }

  if (!colNames.has('verification_locked_until')) {
    await run(db, "ALTER TABLE users ADD COLUMN verification_locked_until TEXT");
  }

  if (!colNames.has('last_resend_attempt_at')) {
    await run(db, "ALTER TABLE users ADD COLUMN last_resend_attempt_at TEXT");
  }

  if (!colNames.has('resend_attempts_in_window')) {
    await run(db, "ALTER TABLE users ADD COLUMN resend_attempts_in_window INTEGER NOT NULL DEFAULT 0");
  }

  // Create resend_otp_tracking table if it doesn't exist
  const otpTrackingTableCheck = await get(
    db,
    "SELECT name FROM sqlite_master WHERE type='table' AND name='resend_otp_tracking'"
  );

  if (!otpTrackingTableCheck) {
    await run(
      db,
      `CREATE TABLE IF NOT EXISTS resend_otp_tracking (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        attempted_at TEXT NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )`
    );
  }
}

async function getUserByEmail(db, email) {
  return get(db, 'SELECT * FROM users WHERE email = ?', [email]);
}

async function getUserById(db, id) {
  return get(db, 'SELECT * FROM users WHERE id = ?', [id]);
}

async function createUser(db, { name, email, passwordHash, emailVerified = 0 }) {
  const createdAt = new Date().toISOString();
  await run(
    db,
    'INSERT INTO users (name, email, password_hash, role, email_verified, created_at) VALUES (?, ?, ?, ?, ?, ?)',
    [name, email, passwordHash, 'user', emailVerified ? 1 : 0, createdAt]
  );
  return getUserByEmail(db, email);
}

async function markUserEmailVerified(db, userId) {
  await run(db, 'UPDATE users SET email_verified = 1 WHERE id = ?', [userId]);
}

async function updateUnverifiedUserCredentials(db, userId, name, passwordHash) {
  await run(
    db,
    'UPDATE users SET name = ?, password_hash = ? WHERE id = ? AND email_verified = 0',
    [name, passwordHash, userId]
  );
}

async function createEmailVerificationOtp(db, { userId, email, codeHash, expiresAt }) {
  const createdAt = new Date().toISOString();
  await run(
    db,
    'INSERT INTO email_verification_otps (user_id, email, code_hash, expires_at, created_at) VALUES (?, ?, ?, ?, ?)',
    [userId, email, codeHash, expiresAt, createdAt]
  );
  return get(db, 'SELECT * FROM email_verification_otps ORDER BY id DESC LIMIT 1', []);
}

async function getLatestUnexpiredOtpForUserEmail(db, { userId, email, nowIso }) {
  return get(
    db,
    `SELECT * FROM email_verification_otps
     WHERE user_id = ? AND email = ? AND expires_at > ? AND used_at IS NULL
     ORDER BY id DESC
     LIMIT 1`,
    [userId, email, nowIso]
  );
}

async function markOtpAsUsed(db, otpId) {
  await run(db, 'UPDATE email_verification_otps SET used_at = ? WHERE id = ?', [new Date().toISOString(), otpId]);
}

async function saveRefreshToken(db, userId, tokenHash, expiresAt) {
  const createdAt = new Date().toISOString();
  await run(
    db,
    'INSERT INTO refresh_tokens (user_id, token_hash, expires_at, created_at) VALUES (?, ?, ?, ?)',
    [userId, tokenHash, expiresAt, createdAt]
  );
}

async function getRefreshToken(db, tokenHash) {
  return get(db, 'SELECT * FROM refresh_tokens WHERE token_hash = ?', [tokenHash]);
}

async function deleteRefreshToken(db, tokenHash) {
  await run(db, 'DELETE FROM refresh_tokens WHERE token_hash = ?', [tokenHash]);
}

async function deleteUserRefreshTokens(db, userId) {
  await run(db, 'DELETE FROM refresh_tokens WHERE user_id = ?', [userId]);
}

function parseAdRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    title: row.title,
    type: row.type,
    make: row.make,
    model: row.model,
    year: row.year,
    price: row.price,
    location: row.location,
    mileage: row.mileage,
    transmission: row.transmission,
    fuel: row.fuel,
    engine: row.engine,
    engineCapacity: row.engine_capacity,
    power: row.power || '',
    topSpeed: row.top_speed,
    zeroToHundred: row.zero_to_hundred || '',
    condition: row.condition,
    dutyStatus: row.duty_status,
    sellerName: row.seller_name,
    sellerPhone: row.seller_phone,
    sellerEmail: row.seller_email,
    description: row.description,
    images: JSON.parse(row.images || '[]'),
    publisherId: row.publisher_id,
    status: row.status,
    dateAdded: row.date_added,
    featured: Boolean(row.featured),
  };
}

function parseSparePartRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    compatible: row.compatible,
    condition: row.condition,
    price: row.price,
    location: row.location,
    sellerName: row.seller_name,
    sellerPhone: row.seller_phone,
    description: row.description,
    images: JSON.parse(row.images || '[]'),
    publisherId: row.publisher_id,
    dateAdded: row.date_added,
  };
}

async function getAllActiveAds(db) {
  const rows = await all(db, "SELECT * FROM ads WHERE status = 'active' ORDER BY date_added DESC");
  return rows.map(parseAdRow);
}

async function getAdById(db, id) {
  const row = await get(db, 'SELECT * FROM ads WHERE id = ?', [id]);
  return parseAdRow(row);
}

async function createAd(db, ad) {
  await run(
    db,
    `INSERT INTO ads (
      id, title, type, make, model, year, price, location, mileage, transmission, fuel,
      engine, engine_capacity, power, top_speed, zero_to_hundred, condition, duty_status,
      seller_name, seller_phone, seller_email, description, images, publisher_id, status,
      date_added, featured
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      ad.id,
      ad.title,
      ad.type,
      ad.make,
      ad.model,
      ad.year,
      ad.price,
      ad.location,
      ad.mileage,
      ad.transmission,
      ad.fuel,
      ad.engine,
      ad.engineCapacity,
      ad.power || '',
      ad.topSpeed || null,
      ad.zeroToHundred || '',
      ad.condition,
      ad.dutyStatus,
      ad.sellerName,
      ad.sellerPhone,
      ad.sellerEmail,
      ad.description,
      JSON.stringify(ad.images || []),
      ad.publisherId || null,
      ad.status || 'pending_payment',
      ad.dateAdded,
      ad.featured ? 1 : 0,
    ]
  );
}

async function updateAdStatus(db, id, status) {
  await run(db, 'UPDATE ads SET status = ? WHERE id = ?', [status, id]);
}

async function deleteAd(db, id) {
  await run(db, 'DELETE FROM ads WHERE id = ?', [id]);
}

async function getAllSpareParts(db) {
  const rows = await all(db, 'SELECT * FROM spare_parts ORDER BY date_added DESC');
  return rows.map(parseSparePartRow);
}

async function getSparePartById(db, id) {
  const row = await get(db, 'SELECT * FROM spare_parts WHERE id = ?', [id]);
  return parseSparePartRow(row);
}

async function createSparePart(db, part) {
  await run(
    db,
    `INSERT INTO spare_parts (
      id, name, category, compatible, condition, price, location,
      seller_name, seller_phone, description, images, publisher_id, date_added
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      part.id,
      part.name,
      part.category,
      part.compatible,
      part.condition,
      part.price,
      part.location,
      part.sellerName,
      part.sellerPhone,
      part.description,
      JSON.stringify(part.images || []),
      part.publisherId,
      part.dateAdded,
    ]
  );
}

async function deleteSparePart(db, id) {
  await run(db, 'DELETE FROM spare_parts WHERE id = ?', [id]);
}

async function countAds(db) {
  const row = await get(db, 'SELECT COUNT(*) as count FROM ads');
  return row ? row.count : 0;
}

async function seedPreloadedAds(db, ads) {
  const count = await countAds(db);
  if (count > 0) return;

  for (const ad of ads) {
    await createAd(db, {
      ...ad,
      status: 'active',
      publisherId: null,
    });
  }
}

// ── Verification attempt tracking ──────────────────────────────────────────
async function incrementVerificationFailedAttempts(db, userId) {
  await run(
    db,
    'UPDATE users SET verification_failed_attempts = verification_failed_attempts + 1 WHERE id = ?',
    [userId]
  );
}

async function resetVerificationFailedAttempts(db, userId) {
  await run(
    db,
    'UPDATE users SET verification_failed_attempts = 0 WHERE id = ?',
    [userId]
  );
}

async function lockVerificationAttempts(db, userId, lockUntil) {
  await run(
    db,
    'UPDATE users SET verification_locked_until = ? WHERE id = ?',
    [lockUntil, userId]
  );
}

async function isVerificationLocked(db, userId) {
  const user = await getUserById(db, userId);
  if (!user || !user.verification_locked_until) {
    return false;
  }
  const now = new Date();
  const lockedUntil = new Date(user.verification_locked_until);
  return now < lockedUntil;
}

// ── Resend OTP attempt tracking ────────────────────────────────────────────
async function recordResendAttempt(db, userId) {
  const attemptedAt = new Date().toISOString();
  await run(
    db,
    'INSERT INTO resend_otp_tracking (user_id, attempted_at) VALUES (?, ?)',
    [userId, attemptedAt]
  );
}

async function getResendAttemptsInWindow(db, userId, windowMs) {
  const cutoffTime = new Date(Date.now() - windowMs).toISOString();
  const result = await get(
    db,
    `SELECT COUNT(*) as count FROM resend_otp_tracking
     WHERE user_id = ? AND attempted_at > ?`,
    [userId, cutoffTime]
  );
  return result?.count || 0;
}

async function cleanupOldResendAttempts(db, userId, windowMs) {
  const cutoffTime = new Date(Date.now() - windowMs).toISOString();
  await run(
    db,
    'DELETE FROM resend_otp_tracking WHERE user_id = ? AND attempted_at <= ?',
    [userId, cutoffTime]
  );
}

module.exports = {
  DB_PATH,
  openDb,
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
};
