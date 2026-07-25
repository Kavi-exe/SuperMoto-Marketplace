/**
 * clear-users.js
 * Deletes ALL user accounts (and their related data) from the SQLite database.
 * Related rows in refresh_tokens, email_verification_otps, resend_otp_tracking,
 * and admins are removed automatically via ON DELETE CASCADE foreign keys.
 *
 * Usage:  node clear-users.js
 */

const { openDb } = require('./database');

async function run(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) return reject(err);
      resolve(this);
    });
  });
}

async function all(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) return reject(err);
      resolve(rows || []);
    });
  });
}

async function main() {
  const db = openDb();

  // Enable foreign key support (required for CASCADE deletes in SQLite)
  await run(db, 'PRAGMA foreign_keys = ON');

  // List users that will be deleted
  const users = await all(db, 'SELECT id, name, email, role, email_verified FROM users ORDER BY id');

  if (users.length === 0) {
    console.log('No registered users found. Nothing to delete.');
    db.close();
    return;
  }

  console.log(`\nFound ${users.length} user(s) to delete:\n`);
  users.forEach((u) => {
    const verified = u.email_verified ? '✔ verified' : '✘ unverified';
    console.log(`  [${u.id}] ${u.name} <${u.email}> (${u.role}, ${verified})`);
  });

  // Nullify publisher_id in ads & spare_parts (no CASCADE on those FKs)
  await run(db, 'UPDATE ads SET publisher_id = NULL WHERE publisher_id IS NOT NULL');
  await run(db, 'UPDATE spare_parts SET publisher_id = NULL WHERE publisher_id IS NOT NULL');

  // Delete all users — cascade deletes refresh_tokens, email_verification_otps,
  // resend_otp_tracking, and admins automatically.
  const result = await run(db, 'DELETE FROM users');
  console.log(`\n✅ Deleted ${result.changes} user account(s) successfully.`);
  console.log('   Related data (tokens, OTPs, admin records) removed via CASCADE.');
  console.log('   Ads/spare-parts publisher references set to NULL.\n');

  db.close();
}

main().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});
