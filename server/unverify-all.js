/**
 * unverify-all.js
 * Marks ALL user accounts as unverified (email_verified = 0) and clears any
 * existing email verification OTP rows, so the OTP/verification flow can be
 * re-tested from scratch.
 *
 * Usage:  node unverify-all.js
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

async function main() {
  const db = openDb();

  const result = await run(db, "UPDATE users SET email_verified = 0, verification_failed_attempts = 0, verification_locked_until = NULL");
  console.log(`Marked ${result.changes} user(s) as unverified.`);

  await run(db, 'DELETE FROM email_verification_otps');
  console.log('Cleared existing email verification OTP rows.');

  db.close();
}

main().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});
