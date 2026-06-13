// Seed entitlements. Idempotent. Exécution manuelle.
//   pnpm exec node --env-file-if-exists=.env scripts/db/seed-entitlements.mjs OWNER_EMAIL=contact@nedellec-julien.fr
// - Promeut OWNER_EMAIL au rôle 'admin'.
// - Donne au compte démo (is_demo_account = true) une souscription family_health (source admin).
import postgres from 'postgres';

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL manquant.');
  process.exit(1);
}

const ownerArg = process.argv.find((a) => a.startsWith('OWNER_EMAIL='));
const ownerEmail = ownerArg ? ownerArg.split('=')[1] : process.env.OWNER_EMAIL;

const sql = postgres(url, { max: 1 });
try {
  if (ownerEmail) {
    const updated = await sql`
      UPDATE users SET role = 'admin' WHERE email = ${ownerEmail} RETURNING id`;
    console.log(updated.length ? `Owner ${ownerEmail} → admin.` : `Aucun user pour ${ownerEmail}.`);
  } else {
    console.log('OWNER_EMAIL non fourni → promotion admin ignorée.');
  }

  const demo = await sql`SELECT id FROM users WHERE is_demo_account = true LIMIT 1`;
  if (demo.length) {
    const demoId = demo[0].id;
    await sql`
      INSERT INTO subscriptions (user_id, plan_key, status, source)
      VALUES (${demoId}, 'family_health', 'active', 'admin')
      ON CONFLICT (user_id) DO UPDATE
        SET plan_key = 'family_health', status = 'active', source = 'admin', updated_at = now()`;
    console.log('Compte démo → family_health (admin).');
  } else {
    console.log('Aucun compte démo → seed démo ignoré.');
  }
} catch (err) {
  console.error('Échec du seed :', err);
  process.exitCode = 1;
} finally {
  await sql.end();
}
