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

  if (!colNames.has('status')) {
    await run(db, "ALTER TABLE users ADD COLUMN status TEXT NOT NULL DEFAULT 'active'");
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

  // Create admin_logs table if it doesn't exist
  await run(
    db,
    `CREATE TABLE IF NOT EXISTS admin_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      admin_id INTEGER,
      action TEXT NOT NULL,
      target_type TEXT,
      target_id TEXT,
      details TEXT,
      created_at TEXT NOT NULL
    )`
  );
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

// ── Admin helpers ──────────────────────────────────────────────────────────

async function adminGetStats(db) {
  const totalUsers    = (await get(db, 'SELECT COUNT(*) as c FROM users')).c;
  const verifiedUsers = (await get(db, 'SELECT COUNT(*) as c FROM users WHERE email_verified = 1')).c;
  const adminUsers    = (await get(db, "SELECT COUNT(*) as c FROM users WHERE role = 'admin'")).c;
  const suspendedUsers= (await get(db, "SELECT COUNT(*) as c FROM users WHERE status = 'suspended'")).c;
  const totalAds      = (await get(db, 'SELECT COUNT(*) as c FROM ads')).c;
  const activeAds     = (await get(db, "SELECT COUNT(*) as c FROM ads WHERE status = 'active'")).c;
  const pendingAds    = (await get(db, "SELECT COUNT(*) as c FROM ads WHERE status = 'pending_payment'")).c;
  const featuredAds   = (await get(db, 'SELECT COUNT(*) as c FROM ads WHERE featured = 1')).c;
  const totalSpareParts = (await get(db, 'SELECT COUNT(*) as c FROM spare_parts')).c;
  const recentUsers   = await all(db, 'SELECT id, name, email, role, created_at FROM users ORDER BY id DESC LIMIT 5');
  const recentAds     = await all(db, "SELECT id, title, make, model, status, date_added FROM ads ORDER BY date_added DESC LIMIT 5");
  return {
    totalUsers, verifiedUsers, unverifiedUsers: totalUsers - verifiedUsers,
    adminUsers, suspendedUsers, totalAds, activeAds, pendingAds,
    featuredAds, totalSpareParts, revenueTotal: 0,
    recentUsers, recentAds,
  };
}

async function adminGetUsers(db, { page = 1, limit = 20, search = null, role = 'all', status = 'all' } = {}) {
  const offset = (page - 1) * limit;
  const conditions = [];
  const params = [];
  if (search) {
    conditions.push('(name LIKE ? OR email LIKE ?)');
    params.push(`%${search}%`, `%${search}%`);
  }
  if (role !== 'all') { conditions.push('role = ?'); params.push(role); }
  if (status === 'suspended') { conditions.push("status = 'suspended'"); }
  else if (status === 'active')   { conditions.push("status = 'active'"); }
  else if (status === 'unverified') { conditions.push('email_verified = 0'); }
  const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';
  const rows  = await all(db, `SELECT id, name, email, role, status, email_verified, created_at FROM users ${where} ORDER BY id DESC LIMIT ? OFFSET ?`, [...params, limit, offset]);
  const total = (await get(db, `SELECT COUNT(*) as c FROM users ${where}`, params)).c;
  return { users: rows, total };
}

async function adminUpdateUserRole(db, userId, role) {
  await run(db, 'UPDATE users SET role = ? WHERE id = ?', [role, userId]);
}

async function adminSuspendUser(db, userId) {
  await run(db, "UPDATE users SET status = 'suspended' WHERE id = ?", [userId]);
}

async function adminUnsuspendUser(db, userId) {
  await run(db, "UPDATE users SET status = 'active' WHERE id = ?", [userId]);
}

async function adminDeleteUser(db, userId) {
  await run(db, 'DELETE FROM users WHERE id = ?', [userId]);
}

async function adminGetAds(db, { page = 1, limit = 20, search = null, status = 'all' } = {}) {
  const offset = (page - 1) * limit;
  const conditions = [];
  const params = [];
  if (status !== 'all') { conditions.push('a.status = ?'); params.push(status); }
  if (search) {
    conditions.push('(a.title LIKE ? OR a.make LIKE ? OR a.model LIKE ? OR a.seller_name LIKE ?)');
    params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
  }
  const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';
  const rows  = await all(db,
    `SELECT a.id, a.title, a.type, a.make, a.model, a.year, a.price, a.location,
            a.status, a.featured, a.date_added, a.seller_name, a.seller_email,
            a.images, a.publisher_id, u.name as publisher_name, u.email as publisher_email
     FROM ads a LEFT JOIN users u ON a.publisher_id = u.id
     ${where} ORDER BY a.date_added DESC LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );
  const total = (await get(db, `SELECT COUNT(*) as c FROM ads a ${where}`, params)).c;
  const ads = rows.map(r => ({
    id: r.id, title: r.title, type: r.type, make: r.make, model: r.model,
    year: r.year, price: r.price, location: r.location, status: r.status,
    featured: Boolean(r.featured), dateAdded: r.date_added,
    sellerName: r.seller_name, sellerEmail: r.seller_email,
    publisherId: r.publisher_id, publisherName: r.publisher_name || null,
    publisherEmail: r.publisher_email || null,
    images: JSON.parse(r.images || '[]'),
  }));
  return { ads, total };
}

async function adminSetAdStatus(db, id, status) {
  await run(db, 'UPDATE ads SET status = ? WHERE id = ?', [status, id]);
}

async function adminToggleAdFeatured(db, id) {
  const row = await get(db, 'SELECT featured FROM ads WHERE id = ?', [id]);
  if (!row) return null;
  const next = row.featured ? 0 : 1;
  await run(db, 'UPDATE ads SET featured = ? WHERE id = ?', [next, id]);
  return Boolean(next);
}

async function adminDeleteAd(db, id) {
  await run(db, 'DELETE FROM ads WHERE id = ?', [id]);
}

async function adminGetSpareParts(db, { page = 1, limit = 20, search = null } = {}) {
  const offset = (page - 1) * limit;
  let where = '', params = [];
  if (search) {
    where = 'WHERE sp.name LIKE ? OR sp.seller_name LIKE ? OR sp.category LIKE ?';
    params = [`%${search}%`, `%${search}%`, `%${search}%`];
  }
  const rows  = await all(db,
    `SELECT sp.*, u.name as publisher_name, u.email as publisher_email
     FROM spare_parts sp LEFT JOIN users u ON sp.publisher_id = u.id
     ${where} ORDER BY sp.date_added DESC LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );
  const total = (await get(db, `SELECT COUNT(*) as c FROM spare_parts sp ${where}`, params)).c;
  const parts = rows.map(r => ({
    id: r.id, name: r.name, category: r.category, condition: r.condition,
    price: r.price, location: r.location, sellerName: r.seller_name,
    publisherId: r.publisher_id, publisherName: r.publisher_name || null,
    publisherEmail: r.publisher_email || null, dateAdded: r.date_added,
    images: JSON.parse(r.images || '[]'),
  }));
  return { spareParts: parts, total };
}

async function adminDeleteSparePart(db, id) {
  await run(db, 'DELETE FROM spare_parts WHERE id = ?', [id]);
}

async function adminGetActivityLog(db, limit = 50) {
  const rows = await all(db,
    `SELECT l.*, u.name as admin_name, u.email as admin_email
     FROM admin_logs l LEFT JOIN users u ON l.admin_id = u.id
     ORDER BY l.id DESC LIMIT ?`, [limit]
  );
  return rows;
}

async function adminLogAction(db, { adminId, action, targetType = null, targetId = null, details = null }) {
  await run(db,
    'INSERT INTO admin_logs (admin_id, action, target_type, target_id, details, created_at) VALUES (?, ?, ?, ?, ?, ?)',
    [adminId, action, targetType, targetId ? String(targetId) : null, details, new Date().toISOString()]
  );
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

// ── Admin Helpers ──────────────────────────────────────────────────────────

async function adminGetStats(db) {
  const totalUsers = (await get(db, 'SELECT COUNT(*) as c FROM users')).c || 0;
  const verifiedUsers = (await get(db, 'SELECT COUNT(*) as c FROM users WHERE email_verified = 1')).c || 0;
  const adminUsers = (await get(db, "SELECT COUNT(*) as c FROM users WHERE role = 'admin'")).c || 0;
  const suspendedUsers = (await get(db, "SELECT COUNT(*) as c FROM users WHERE role = 'suspended'")).c || 0;
  const totalAds = (await get(db, 'SELECT COUNT(*) as c FROM ads')).c || 0;
  const activeAds = (await get(db, "SELECT COUNT(*) as c FROM ads WHERE status = 'active'")).c || 0;
  const pendingAds = (await get(db, "SELECT COUNT(*) as c FROM ads WHERE status = 'pending_payment'")).c || 0;
  const featuredAds = (await get(db, 'SELECT COUNT(*) as c FROM ads WHERE featured = 1')).c || 0;
  const totalSpareParts = (await get(db, 'SELECT COUNT(*) as c FROM spare_parts')).c || 0;
  return {
    totalUsers,
    verifiedUsers,
    adminUsers,
    suspendedUsers,
    totalAds,
    activeAds,
    pendingAds,
    featuredAds,
    totalSpareParts,
    revenueTotal: 0,
  };
}

async function adminGetUsers(db, { page = 1, limit = 15, search = '', role = 'all', status = 'all' } = {}) {
  const offset = (page - 1) * limit;
  const conditions = [];
  const params = [];

  if (search) {
    conditions.push("(name LIKE ? OR email LIKE ?)");
    params.push(`%${search}%`, `%${search}%`);
  }
  if (role !== 'all') {
    conditions.push("role = ?");
    params.push(role);
  }
  if (status === 'suspended') {
    conditions.push("role = 'suspended'");
  } else if (status === 'unverified') {
    conditions.push("email_verified = 0");
  } else if (status === 'active') {
    conditions.push("role != 'suspended' AND email_verified = 1");
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const total = (await get(db, `SELECT COUNT(*) as c FROM users ${where}`, params)).c || 0;
  const rows = await all(db, `SELECT * FROM users ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`, [...params, limit, offset]);
  return { users: rows, total };
}

async function adminUpdateUserRole(db, userId, role) {
  await run(db, 'UPDATE users SET role = ? WHERE id = ?', [role, userId]);
}

async function adminDeleteUser(db, userId) {
  await run(db, 'DELETE FROM users WHERE id = ?', [userId]);
}

async function adminGetAds(db, { page = 1, limit = 15, search = '', status = 'all' } = {}) {
  const offset = (page - 1) * limit;
  const conditions = [];
  const params = [];

  if (search) {
    conditions.push("(title LIKE ? OR make LIKE ? OR model LIKE ?)");
    params.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }
  if (status === 'featured') {
    conditions.push("featured = 1");
  } else if (status !== 'all') {
    conditions.push("status = ?");
    params.push(status);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const total = (await get(db, `SELECT COUNT(*) as c FROM ads ${where}`, params)).c || 0;
  const rows = await all(
    db,
    `SELECT ads.*, users.name as publisher_name, users.email as publisher_email
     FROM ads
     LEFT JOIN users ON ads.publisher_id = users.id
     ${where}
     ORDER BY ads.date_added DESC
     LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );
  return { ads: rows.map(r => ({ ...parseAdRow(r), publisherName: r.publisher_name, publisherEmail: r.publisher_email })), total };
}

async function adminSetAdStatus(db, id, status) {
  await run(db, 'UPDATE ads SET status = ? WHERE id = ?', [status, id]);
}

async function adminToggleAdFeatured(db, id) {
  await run(db, 'UPDATE ads SET featured = CASE WHEN featured = 1 THEN 0 ELSE 1 END WHERE id = ?', [id]);
}

async function adminDeleteAd(db, id) {
  await run(db, 'DELETE FROM ads WHERE id = ?', [id]);
}

async function adminGetSpareParts(db, { page = 1, limit = 15, search = '' } = {}) {
  const offset = (page - 1) * limit;
  const conditions = [];
  const params = [];

  if (search) {
    conditions.push("(name LIKE ? OR category LIKE ?)");
    params.push(`%${search}%`, `%${search}%`);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const total = (await get(db, `SELECT COUNT(*) as c FROM spare_parts ${where}`, params)).c || 0;
  const rows = await all(
    db,
    `SELECT spare_parts.*, users.name as publisher_name
     FROM spare_parts
     LEFT JOIN users ON spare_parts.publisher_id = users.id
     ${where}
     ORDER BY spare_parts.date_added DESC
     LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );
  return {
    spareParts: rows.map(r => ({ ...parseSparePartRow(r), publisherName: r.publisher_name })),
    total,
  };
}

async function adminDeleteSparePart(db, id) {
  await run(db, 'DELETE FROM spare_parts WHERE id = ?', [id]);
}

async function adminGetActivityLog(db, limit = 50) {
  const rows = await all(
    db,
    `SELECT admin_logs.*, users.name as admin_name, users.email as admin_email
     FROM admin_logs
     LEFT JOIN users ON admin_logs.admin_id = users.id
     ORDER BY admin_logs.created_at DESC
     LIMIT ?`,
    [limit]
  );
  return rows;
}

async function adminLogAction(db, { adminId, action, targetType, targetId, details }) {
  const createdAt = new Date().toISOString();
  await run(
    db,
    'INSERT INTO admin_logs (admin_id, action, target_type, target_id, details, created_at) VALUES (?, ?, ?, ?, ?, ?)',
    [adminId || null, action, targetType || null, targetId ? String(targetId) : null, details || null, createdAt]
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
  adminGetStats,
  adminGetUsers,
  adminUpdateUserRole,
  adminSuspendUser,
  adminUnsuspendUser,
  adminDeleteUser,
  adminGetAds,
  adminSetAdStatus,
  adminToggleAdFeatured,
  adminDeleteAd,
  adminGetSpareParts,
  adminDeleteSparePart,
  adminGetActivityLog,
  adminLogAction,
};
