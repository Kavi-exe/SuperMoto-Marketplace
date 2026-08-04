const path = require('path');
const fs = require('fs');
const sqlite3 = require('sqlite3').verbose();

const DB_PATH = path.join(__dirname, 'data', 'app.sqlite');
const BACKUP_DIR = path.join(__dirname, 'backups');
const KEEP = Number(process.env.BACKUP_KEEP || 30);

function timestamp() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

async function runBackup() {
  if (!fs.existsSync(DB_PATH)) {
    console.log('[backup] No database found at', DB_PATH, '- nothing to back up.');
    return 0;
  }

  fs.mkdirSync(BACKUP_DIR, { recursive: true });

  const dest = path.join(BACKUP_DIR, `backup-${timestamp()}.sqlite`);
  const escaped = dest.replace(/'/g, "''");

  await new Promise((resolve, reject) => {
    const db = new sqlite3.Database(DB_PATH);
    db.exec(`VACUUM INTO '${escaped}'`, (err) => {
      db.close();
      if (err) return reject(err);
      resolve();
    });
  });

  const sizeMb = (fs.statSync(dest).size / 1024 / 1024).toFixed(2);
  console.log(`[backup] Created ${dest} (${sizeMb} MB)`);

  const backups = fs
    .readdirSync(BACKUP_DIR)
    .filter((f) => /^backup-\d{8}-\d{6}\.sqlite$/.test(f))
    .sort()
    .reverse();

  for (const stale of backups.slice(KEEP)) {
    fs.unlinkSync(path.join(BACKUP_DIR, stale));
    console.log(`[backup] Pruned ${stale}`);
  }

  return 0;
}

runBackup()
  .then((code) => process.exit(code))
  .catch((err) => {
    console.error('[backup] Failed:', err.message);
    process.exit(1);
  });
