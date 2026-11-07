import { afterAll, beforeAll, describe, it, expect } from 'vitest';
import { randomBytes } from 'node:crypto';
import { resolve } from 'node:path';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import * as schema from '../src/db/schema';
import { DemoService } from '../src/modules/demo/demo.service';
import {
  initPreviewDatabase,
  PreviewSeedRefusedError,
} from '../src/db/preview-seed';

/**
 * Base dédiée, créée puis détruite par ce fichier : la commande d'initialisation part d'une base
 * VIDE, et ses refus doivent être vérifiés sans toucher à la base partagée des autres specs (qui
 * peut être une copie locale de la prod).
 */
const adminUrl = process.env.DATABASE_URL;
if (!adminUrl)
  throw new Error('DATABASE_URL requis pour les tests d’intégration');

const dbName = `dashflow_preview_seed_${randomBytes(4).toString('hex')}`;
const admin = postgres(adminUrl, { max: 1 });
const url = new URL(adminUrl);
url.pathname = `/${dbName}`;
const sql = postgres(url.toString(), { max: 1, onnotice: () => {} });
const db = drizzle(sql, { schema });

const paths = {
  migrationsFolder: resolve('src/db/migrations'),
  snapshotSqlPath: resolve('scripts/demo-seed-snapshot.sql'),
};

const count = async (table: string): Promise<number> => {
  const [row] = await sql<{ n: number }[]>`
    select count(*)::int as n from ${sql(table)}`;
  return row?.n ?? Number.NaN;
};

const countUsers = async (demo: boolean): Promise<number> => {
  const [row] = await sql<{ n: number }[]>`
    select count(*)::int as n from users where is_demo_account = ${demo}`;
  return row?.n ?? Number.NaN;
};

beforeAll(async () => {
  await admin`create database ${admin(dbName)}`;
});

afterAll(async () => {
  await sql.end();
  await admin`drop database if exists ${admin(dbName)} with (force)`;
  await admin.end();
});

describe('initPreviewDatabase (base vide jetable)', () => {
  it('refuse VERCEL_ENV=production avant toute requête : la base reste vide', async () => {
    await expect(
      initPreviewDatabase(sql, { ...paths, env: { VERCEL_ENV: 'production' } }),
    ).rejects.toThrow(PreviewSeedRefusedError);
    const [row] = await sql<{ reg: string | null }[]>`
      select to_regclass('public.users') as reg`;
    expect(row?.reg).toBeNull();
  });

  it('migre, crée le compte démo et ses snapshots ; le reset démo fonctionne', async () => {
    const report = await initPreviewDatabase(sql, { ...paths, env: {} });

    expect(await countUsers(true)).toBe(1);
    expect(await countUsers(false)).toBe(0);
    expect(report.demoEmail).toMatch(/@demo\.dashflow\.test$/);
    expect(await count('patients')).toBeGreaterThan(0);
    expect(await count('account_transactions')).toBeGreaterThan(0);
    expect(await count('demo_seed_patients')).toBe(await count('patients'));
    expect(await count('demo_seed_meta')).toBe(1);

    await new DemoService(db, { DEMO_ENABLED: true }).reset();
    expect(await count('patients')).toBe(await count('demo_seed_patients'));
  });

  it('est relançable : recrée les données de démo sans doublon', async () => {
    await initPreviewDatabase(sql, { ...paths, env: {} });
    expect(await count('users')).toBe(1);
    expect(await count('patients')).toBe(await count('demo_seed_patients'));
  });

  it('refuse une base qui contient un compte hors démo, sans rien modifier', async () => {
    await sql`insert into users (email) values ('vraie.personne@example.com')`;
    const before = await count('patients');

    await expect(
      initPreviewDatabase(sql, { ...paths, env: {} }),
    ).rejects.toThrow(/compte/);

    expect(await countUsers(false)).toBe(1);
    expect(await count('patients')).toBe(before);
  });
});
