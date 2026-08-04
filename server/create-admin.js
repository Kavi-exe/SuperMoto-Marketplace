const { openDb, initSchema, getUserByEmail, run } = require('./database');

async function main() {
  const email = process.argv[2];

  if (!email) {
    console.log('Usage: node create-admin.js <email>');
    process.exit(1);
  }

  await initSchema();

  const db = openDb();
  const normalizedEmail = String(email).trim().toLowerCase();
  const user = await getUserByEmail(db, normalizedEmail);

  if (!user) {
    db.close();
    console.log(`User not found for email: ${normalizedEmail}`);
    process.exit(1);
  }

  const now = new Date().toISOString();

  await run(db, "UPDATE users SET role = 'admin', updated_at = ? WHERE id = ?", [now, user.id]);
  await run(
    db,
    'INSERT INTO admins (user_id, full_name, email, permissions, created_at) VALUES (?, ?, ?, ?, ?) ON CONFLICT(user_id) DO NOTHING',
    [user.id, user.name, user.email, 'all', now]
  );

  const existing = await db.get('SELECT id FROM admins WHERE user_id = ?', [user.id]);
  if (existing) {
    await run(db, 'UPDATE admins SET permissions = ? WHERE user_id = ?', ['all', user.id]);
  }

  db.close();
  console.log(`Promoted ${user.email} to admin.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
