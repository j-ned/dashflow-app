// Marque les migrations présentes comme DÉJÀ APPLIQUÉES sur une base qui contient
// déjà le schéma (dump prod restauré), SANS exécuter leur SQL. Idempotent.
//
// Dev  : pnpm db:baseline                (charge .env si présent)
// Prod : DATABASE_URL=... node scripts/db/baseline.mjs   (env injecté par Dokploy)
import { readMigrationFiles } from 'drizzle-orm/migrator';
import postgres from 'postgres';

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL manquant.');
  process.exit(1);
}

const MIGRATIONS_FOLDER = 'src/db/migrations';
const SCHEMA = 'drizzle';
const TABLE = '__drizzle_migrations_nest';

const migrations = readMigrationFiles({ migrationsFolder: MIGRATIONS_FOLDER });
if (migrations.length === 0) {
  console.error(`Aucune migration dans ${MIGRATIONS_FOLDER}. Lance d'abord "pnpm db:generate".`);
  process.exit(1);
}

const sql = postgres(url, { max: 1 });
try {
  await sql.unsafe(`CREATE SCHEMA IF NOT EXISTS "${SCHEMA}"`);
  await sql.unsafe(
    `CREATE TABLE IF NOT EXISTS "${SCHEMA}"."${TABLE}" (
       id SERIAL PRIMARY KEY,
       hash text NOT NULL,
       created_at bigint
     )`,
  );

  let inserted = 0;
  for (const migration of migrations) {
    const existing = await sql`
      SELECT 1 FROM ${sql(SCHEMA)}.${sql(TABLE)} WHERE hash = ${migration.hash} LIMIT 1`;
    if (existing.length > 0) {
      console.log(`= déjà marquée : ${migration.hash.slice(0, 12)}…`);
      continue;
    }
    await sql`
      INSERT INTO ${sql(SCHEMA)}.${sql(TABLE)} (hash, created_at)
      VALUES (${migration.hash}, ${migration.folderMillis})`;
    inserted += 1;
    console.log(`+ marquée appliquée : ${migration.hash.slice(0, 12)}…`);
  }
  console.log(`Terminé : ${inserted} marquée(s), ${migrations.length - inserted} déjà présente(s).`);
} finally {
  await sql.end();
}
