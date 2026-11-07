// Initialise une base de PREVIEW vide : migrations, compte démo fictif, snapshots demo_seed_*.
// Refuse VERCEL_ENV=production et toute base qui contient un compte hors démo.
//   DATABASE_URL="<URL directe de la branche Neon preview>" pnpm --filter @dashflow/api db:init-preview
import { resolve } from 'node:path';
import postgres from 'postgres';
import { initPreviewDatabase } from '../../src/db/preview-seed';

async function main(): Promise<void> {
  const url = process.env['DATABASE_URL'];
  if (!url) throw new Error('DATABASE_URL manquant.');
  const sql = postgres(url, { max: 1, onnotice: () => {} });
  try {
    const report = await initPreviewDatabase(sql, {
      env: process.env,
      migrationsFolder: resolve(__dirname, '../../src/db/migrations'),
      snapshotSqlPath: resolve(__dirname, '../demo-seed-snapshot.sql'),
    });
    console.log(`Base de preview prête. Compte démo : ${report.demoEmail}`);
  } finally {
    await sql.end();
  }
}

main().catch((err: unknown) => {
  console.error(
    `Initialisation refusée ou en échec : ${err instanceof Error ? err.message : String(err)}`,
  );
  process.exitCode = 1;
});
