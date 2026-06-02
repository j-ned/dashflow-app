// Applique les migrations en attente. Migrateur PROGRAMMATIQUE de drizzle-orm
// (déjà dépendance de prod) → pas besoin de drizzle-kit dans l'image de prod.
// Lit les mêmes fichiers + le même journal (drizzle.__drizzle_migrations_nest)
// que `drizzle-kit migrate` et que scripts/db/baseline.mjs → 100% interopérable.
//
// Dev  : pnpm db:migrate                 (charge .env si présent)
// Prod : DATABASE_URL=... node scripts/db/migrate.mjs   (env injecté par Dokploy)
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL manquant.');
  process.exit(1);
}

const sql = postgres(url, { max: 1 });
const db = drizzle(sql);
try {
  await migrate(db, {
    migrationsFolder: 'src/db/migrations',
    migrationsTable: '__drizzle_migrations_nest',
    migrationsSchema: 'drizzle',
  });
  console.log('Migrations à jour.');
} catch (err) {
  console.error('Échec de la migration :', err);
  process.exitCode = 1;
} finally {
  await sql.end();
}
