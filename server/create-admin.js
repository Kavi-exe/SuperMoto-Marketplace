/**
 * CeylonSuperHub — Create Admin / Super Admin
 * ─────────────────────────────────────────────
 * Usage:
 *   node create-admin.js <email> <password> <name> <role>
 *
 * Examples:
 *   node create-admin.js admin@site.com MyPass123 "Site Admin"  admin
 *   node create-admin.js root@site.com  MyPass123 "Super Root"  super_admin
 *
 * If the email already exists, the script will only UPDATE the role.
 * ─────────────────────────────────────────────
 */

const bcrypt = require('bcrypt');
const db     = require('./database');

const ALLOWED_ROLES = ['admin', 'super_admin'];

async function main() {
  const [,, email, password, name, role] = process.argv;

  // ── Validate arguments ─────────────────────────────────────────────────
  if (!email || !role) {
    console.error('\n  Usage: node create-admin.js <email> <password> <name> <role>');
    console.error('  Roles:  admin | super_admin\n');
    process.exit(1);
  }

  if (!ALLOWED_ROLES.includes(role)) {
    console.error(`\n  Invalid role: "${role}"`);
    console.error('  Allowed roles: admin, super_admin\n');
    process.exit(1);
  }

  const normalizedEmail = email.trim().toLowerCase();

  const conn = db.openDb();

  // ── Check if user already exists ───────────────────────────────────────
  const existing = await db.getUserByEmail(conn, normalizedEmail);

  if (existing) {
    // Just update the role, don't touch password
    await db.adminUpdateUserRole(conn, existing.id, role);

    // Also make sure email is verified (so they can log in)
    if (!existing.email_verified) {
      await db.markUserEmailVerified(conn, existing.id);
    }

    console.log('\n  ✅ Role updated successfully');
    console.log('  ──────────────────────────────');
    console.log(`  ID    : ${existing.id}`);
    console.log(`  Name  : ${existing.name}`);
    console.log(`  Email : ${normalizedEmail}`);
    console.log(`  Role  : ${role}`);
    console.log(`  Note  : Password was NOT changed.\n`);
  } else {
    // Create a brand new account
    if (!password || !name) {
      console.error('\n  New account requires: <email> <password> <name> <role>\n');
      process.exit(1);
    }

    if (password.length < 8) {
      console.error('\n  Password must be at least 8 characters.\n');
      process.exit(1);
    }

    const passwordHash = await bcrypt.hash(password.trim(), 12);
    const newUser = await db.createUser(conn, {
      name:          name.trim(),
      email:         normalizedEmail,
      passwordHash,
      emailVerified: 1,   // skip OTP — admin accounts are trusted
    });

    await db.adminUpdateUserRole(conn, newUser.id, role);

    console.log('\n  ✅ Account created successfully');
    console.log('  ──────────────────────────────');
    console.log(`  ID       : ${newUser.id}`);
    console.log(`  Name     : ${name.trim()}`);
    console.log(`  Email    : ${normalizedEmail}`);
    console.log(`  Password : ${password.trim()}`);
    console.log(`  Role     : ${role}`);
    console.log(`\n  👉 They can now log in at http://localhost:3001\n`);
  }

  conn.close();
}

main().catch(err => {
  console.error('\n  Error:', err.message, '\n');
  process.exit(1);
});
