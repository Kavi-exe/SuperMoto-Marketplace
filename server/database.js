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
      auth_method TEXT NOT NULL DEFAULT 'password',
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
      purpose TEXT NOT NULL DEFAULT 'email_verification',
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
  await migrateAdminSchema(db);

  db.close();
}

async function migrateSchema(db) {
  const userColumns = await all(db, 'PRAGMA table_info(users)');
  const colNames = new Set(userColumns.map((c) => c.name));

  if (!colNames.has('role')) {
    await run(db, "ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'user'");
  }

  if (!colNames.has('status')) {
    await run(db, "ALTER TABLE users ADD COLUMN status TEXT NOT NULL DEFAULT 'active'");
  }

  if (!colNames.has('last_login')) {
    await run(db, 'ALTER TABLE users ADD COLUMN last_login TEXT');
  }

  if (!colNames.has('updated_at')) {
    await run(db, 'ALTER TABLE users ADD COLUMN updated_at TEXT');
  }

  if (!colNames.has('email_verified')) {
    await run(db, "ALTER TABLE users ADD COLUMN email_verified INTEGER NOT NULL DEFAULT 0");
  }

  if (!colNames.has('auth_method')) {
    await run(db, "ALTER TABLE users ADD COLUMN auth_method TEXT NOT NULL DEFAULT 'password'");
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

  // Add purpose column to email_verification_otps if missing
  const otpColumns = await all(db, 'PRAGMA table_info(email_verification_otps)');
  const otpColNames = new Set(otpColumns.map((c) => c.name));
  if (!otpColNames.has('purpose')) {
    await run(
      db,
      "ALTER TABLE email_verification_otps ADD COLUMN purpose TEXT NOT NULL DEFAULT 'email_verification'"
    );
  }
}

async function migrateAdminSchema(db) {
  await run(
    db,
    `CREATE TABLE IF NOT EXISTS payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      ad_id TEXT,
      type TEXT NOT NULL DEFAULT 'ad_posting',
      amount INTEGER NOT NULL,
      currency TEXT NOT NULL DEFAULT 'lkr',
      stripe_payment_intent_id TEXT,
      status TEXT NOT NULL DEFAULT 'succeeded',
      created_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
    )`
  );

  await run(
    db,
    `CREATE TABLE IF NOT EXISTS activity_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      action TEXT NOT NULL,
      description TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
    )`
  );

  await run(
    db,
    `CREATE TABLE IF NOT EXISTS admins (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL UNIQUE,
      full_name TEXT NOT NULL,
      email TEXT NOT NULL,
      permissions TEXT NOT NULL DEFAULT 'all',
      created_at TEXT NOT NULL,
      last_login TEXT,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )`
  );
}

async function getUserByEmail(db, email) {
  return get(db, 'SELECT * FROM users WHERE email = ?', [email]);
}

async function getUserById(db, id) {
  return get(db, 'SELECT * FROM users WHERE id = ?', [id]);
}

async function createUser(db, { name, email, passwordHash, emailVerified = 0, authMethod = 'password' }) {
  const createdAt = new Date().toISOString();
  await run(
    db,
    'INSERT INTO users (name, email, password_hash, role, email_verified, auth_method, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [name, email, passwordHash, 'user', emailVerified ? 1 : 0, authMethod, createdAt]
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

async function updateUserPassword(db, userId, passwordHash) {
  await run(db, 'UPDATE users SET password_hash = ? WHERE id = ?', [passwordHash, userId]);
}

async function createEmailVerificationOtp(db, { userId, email, codeHash, expiresAt, purpose = 'email_verification' }) {
  const createdAt = new Date().toISOString();
  await run(
    db,
    'INSERT INTO email_verification_otps (user_id, email, code_hash, expires_at, created_at, purpose) VALUES (?, ?, ?, ?, ?, ?)',
    [userId, email, codeHash, expiresAt, createdAt, purpose]
  );
  return get(db, 'SELECT * FROM email_verification_otps ORDER BY id DESC LIMIT 1', []);
}

async function getLatestUnexpiredOtpForUserEmail(db, { userId, email, nowIso, purpose = 'email_verification' }) {
  return get(
    db,
    `SELECT * FROM email_verification_otps
     WHERE user_id = ? AND email = ? AND expires_at > ? AND used_at IS NULL AND purpose = ?
     ORDER BY id DESC
     LIMIT 1`,
    [userId, email, nowIso, purpose]
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
      ad.status || 'active',
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

// ── Admin helper functions ──────────────────────────────────────
async function getAllUsers(db, { search, sort, filter } = {}) {
  let sql = 'SELECT id, name, email, role, status, email_verified, last_login, created_at FROM users WHERE 1=1';
  const params = [];
  if (search) {
    sql += ' AND (name LIKE ? OR email LIKE ?)';
    params.push(`%${search}%`, `%${search}%`);
  }
  if (filter === 'active') {
    sql += " AND status = 'active'";
  } else if (filter === 'disabled') {
    sql += " AND status = 'disabled'";
  } else if (filter === 'admin') {
    sql += " AND role = 'admin'";
  }
  if (sort === 'name') {
    sql += ' ORDER BY name ASC';
  } else if (sort === 'email') {
    sql += ' ORDER BY email ASC';
  } else if (sort === 'recent') {
    sql += ' ORDER BY created_at DESC';
  } else {
    sql += ' ORDER BY created_at DESC';
  }
  return all(db, sql, params);
}

async function getUserAdCount(db, userId) {
  const row = await get(db, 'SELECT COUNT(*) as count FROM ads WHERE publisher_id = ?', [userId]);
  return row ? row.count : 0;
}

async function updateUserStatus(db, userId, status) {
  const now = new Date().toISOString();
  await run(db, 'UPDATE users SET status = ?, updated_at = ? WHERE id = ?', [status, now, userId]);
}

async function deleteUserById(db, userId) {
  await run(db, 'DELETE FROM users WHERE id = ?', [userId]);
}

async function getAllAds(db, { search, filter } = {}) {
  let sql = 'SELECT * FROM ads WHERE 1=1';
  const params = [];
  if (search) {
    sql += ' AND (title LIKE ? OR make LIKE ? OR model LIKE ? OR seller_name LIKE ?)';
    params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
  }
  if (filter === 'active') {
    sql += " AND status = 'active'";
  } else if (filter === 'pending') {
    sql += " AND status = 'pending'";
  } else if (filter === 'pending_payment') {
    sql += " AND status = 'pending_payment'";
  } else if (filter === 'suspended') {
    sql += " AND status = 'suspended'";
  }
  sql += ' ORDER BY date_added DESC';
  const rows = await all(db, sql, params);
  return rows.map(parseAdRow);
}

async function updateAdFeatured(db, id, featured) {
  await run(db, 'UPDATE ads SET featured = ? WHERE id = ?', [featured ? 1 : 0, id]);
}

async function getFeaturedAds(db) {
  const rows = await all(db, "SELECT * FROM ads WHERE featured = 1 ORDER BY date_added DESC");
  return rows.map(parseAdRow);
}

async function getPendingAds(db) {
  const rows = await all(db, "SELECT * FROM ads WHERE status = 'pending' ORDER BY date_added DESC");
  return rows.map(parseAdRow);
}

async function logActivity(db, userId, action, description) {
  const now = new Date().toISOString();
  await run(db, 'INSERT INTO activity_log (user_id, action, description, created_at) VALUES (?, ?, ?, ?)',
    [userId || null, action, description || '', now]);
}

async function getRecentActivities(db, limit = 20) {
  return all(db,
    'SELECT a.*, u.name as user_name FROM activity_log a LEFT JOIN users u ON a.user_id = u.id ORDER BY a.created_at DESC LIMIT ?',
    [limit]);
}

async function createPayment(db, { userId, adId, type, amount, currency, stripePaymentIntentId, status }) {
  const now = new Date().toISOString();
  await run(db,
    `INSERT INTO payments (user_id, ad_id, type, amount, currency, stripe_payment_intent_id, status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [userId || null, adId || null, type, amount, currency || 'lkr', stripePaymentIntentId || null, status || 'succeeded', now]);
}

async function getRevenueStats(db) {
  const today = new Date().toISOString().split('T')[0];
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const yearStart = new Date(now.getFullYear(), 0, 1).toISOString();

  const allPayments = await all(db, "SELECT * FROM payments WHERE status = 'succeeded'");

  const lifetimeRevenue = allPayments.reduce((sum, p) => sum + p.amount, 0);

  const todayRevenue = allPayments
    .filter(p => p.created_at && p.created_at.startsWith(today))
    .reduce((sum, p) => sum + p.amount, 0);

  const weeklyRevenue = allPayments
    .filter(p => p.created_at && p.created_at >= weekAgo)
    .reduce((sum, p) => sum + p.amount, 0);

  const monthlyRevenue = allPayments
    .filter(p => p.created_at && p.created_at >= monthStart)
    .reduce((sum, p) => sum + p.amount, 0);

  const yearlyRevenue = allPayments
    .filter(p => p.created_at && p.created_at >= yearStart)
    .reduce((sum, p) => sum + p.amount, 0);

  return { todayRevenue, weeklyRevenue, monthlyRevenue, yearlyRevenue, lifetimeRevenue };
}

async function getMonthlyRevenueData(db) {
  const payments = await all(db, "SELECT * FROM payments WHERE status = 'succeeded' ORDER BY created_at ASC");
  const monthly = {};
  payments.forEach(p => {
    if (p.created_at) {
      const key = p.created_at.substring(0, 7);
      monthly[key] = (monthly[key] || 0) + p.amount;
    }
  });
  return monthly;
}

async function getMonthlyUserData(db) {
  const users = await all(db, 'SELECT created_at FROM users ORDER BY created_at ASC');
  const monthly = {};
  users.forEach(u => {
    if (u.created_at) {
      const key = u.created_at.substring(0, 7);
      monthly[key] = (monthly[key] || 0) + 1;
    }
  });
  return monthly;
}

async function getMonthlyAdData(db) {
  const ads = await all(db, 'SELECT date_added FROM ads ORDER BY date_added ASC');
  const monthly = {};
  ads.forEach(a => {
    if (a.date_added) {
      const key = a.date_added.substring(0, 7);
      monthly[key] = (monthly[key] || 0) + 1;
    }
  });
  return monthly;
}

async function getRecentPayments(db, limit = 20) {
  return all(db,
    `SELECT p.*, u.name as user_name FROM payments p LEFT JOIN users u ON p.user_id = u.id ORDER BY p.created_at DESC LIMIT ?`,
    [limit]);
}

async function getDashboardStats(db) {
  const totalUsers = await get(db, 'SELECT COUNT(*) as count FROM users');
  const totalAds = await get(db, 'SELECT COUNT(*) as count FROM ads');
  const activeListings = await get(db, "SELECT COUNT(*) as count FROM ads WHERE status = 'active'");
  const featuredListings = await get(db, 'SELECT COUNT(*) as count FROM ads WHERE featured = 1');
  const pendingApprovals = await get(db, "SELECT COUNT(*) as count FROM ads WHERE status = 'pending'");
  const payments = await all(db, "SELECT * FROM payments WHERE status = 'succeeded'");
  const totalRevenue = payments.reduce((sum, p) => sum + p.amount, 0);

  return {
    totalUsers: totalUsers ? totalUsers.count : 0,
    totalAds: totalAds ? totalAds.count : 0,
    activeListings: activeListings ? activeListings.count : 0,
    featuredListings: featuredListings ? featuredListings.count : 0,
    pendingApprovals: pendingApprovals ? pendingApprovals.count : 0,
    totalRevenue,
  };
}

async function getAllAdmins(db) {
  return all(db,
    `SELECT a.*, u.role, u.status, u.last_login as user_last_login
     FROM admins a JOIN users u ON a.user_id = u.id
     ORDER BY a.created_at DESC`);
}

async function updateUserLastLogin(db, userId) {
  const now = new Date().toISOString();
  await run(db, 'UPDATE users SET last_login = ?, updated_at = ? WHERE id = ?', [now, now, userId]);
}

async function updateAdminLastLogin(db, userId) {
  const now = new Date().toISOString();
  await run(db, 'UPDATE admins SET last_login = ? WHERE user_id = ?', [now, userId]);
}

module.exports = {
  DB_PATH,
  openDb,
  run,
  get,
  all,
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
  updateUserPassword,
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
};
