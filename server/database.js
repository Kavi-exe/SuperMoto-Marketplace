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
  const db = new sqlite3.Database(DB_PATH);
  return db;
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

async function initSchema() {
  const db = openDb();

  const usersTable = `
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
  `;

  // Note: we use express-session in memory/rolling cookie store.
  // Keeping sessions table out for now simplifies local setup.
  await run(db, usersTable);

  db.close();
}


async function getUserByEmail(db, email) {
  return get(db, 'SELECT * FROM users WHERE email = ?', [email]);
}

async function getUserById(db, id) {
  return get(db, 'SELECT * FROM users WHERE id = ?', [id]);
}

module.exports = {
  DB_PATH,
  openDb,
  initSchema,
  getUserByEmail,
  getUserById,
};

