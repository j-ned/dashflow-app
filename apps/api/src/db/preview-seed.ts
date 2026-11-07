import { readFile } from 'node:fs/promises';
import type { Sql } from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { eq, sql as drizzleSql } from 'drizzle-orm';
import * as schema from './schema';

/** Refus d'initialiser : environnement de production ou base qui n'est pas vierge. */
export class PreviewSeedRefusedError extends Error {
  override readonly name = 'PreviewSeedRefusedError';
}

export type PreviewSeedOptions = {
  /** Environnement du processus : seul VERCEL_ENV est lu. */
  readonly env: Readonly<Record<string, string | undefined>>;
  readonly migrationsFolder: string;
  /** scripts/demo-seed-snapshot.sql : fige les données de démo dans les tables demo_seed_*. */
  readonly snapshotSqlPath: string;
};

export type PreviewSeedReport = {
  readonly demoEmail: string;
  readonly demoUserId: string;
};

export const PREVIEW_DEMO_EMAIL = 'demo@demo.dashflow.test';

/** Comptes réels présents ; 0 si la table `users` n'existe pas encore (base vierge). */
async function countNonDemoAccounts(sql: Sql): Promise<number> {
  const [reg] = await sql<{ reg: string | null }[]>`
    select to_regclass('public.users') as reg`;
  if (!reg?.reg) return 0;
  const [row] = await sql<{ n: number }[]>`
    select count(*)::int as n from users where not is_demo_account`;
  return row?.n ?? 0;
}

function refuseNonDemoAccounts(n: number): void {
  if (n > 0)
    throw new PreviewSeedRefusedError(
      `La base contient ${n} compte(s) hors démo : ce n'est pas une base de preview vierge. Rien n'a été modifié.`,
    );
}

/**
 * Initialise une base de preview VIDE : migrations, compte démo et données fictives, puis
 * snapshots demo_seed_* (le mécanisme du reset démo existant). Relançable : les données de démo
 * sont recréées à l'identique. Aucune donnée réelle n'est lue ni copiée.
 */
export async function initPreviewDatabase(
  sql: Sql,
  opts: PreviewSeedOptions,
): Promise<PreviewSeedReport> {
  if (opts.env['VERCEL_ENV'] === 'production')
    throw new PreviewSeedRefusedError(
      'VERCEL_ENV=production : initialisation de preview refusée.',
    );
  refuseNonDemoAccounts(await countNonDemoAccounts(sql));

  const db = drizzle(sql, { schema });
  // Même journal que scripts/db/migrate.mjs et drizzle.config.ts.
  await migrate(db, {
    migrationsFolder: opts.migrationsFolder,
    migrationsTable: '__drizzle_migrations_nest',
    migrationsSchema: 'drizzle',
  });

  const demoUserId = await db.transaction(async (tx) => {
    // Re-vérifié sous verrou : un compte créé entre-temps (preview ouverte) bloque l'opération.
    await tx.execute(drizzleSql`lock table users in share row exclusive mode`);
    const [real] = await tx
      .select({ id: schema.users.id })
      .from(schema.users)
      .where(eq(schema.users.isDemoAccount, false))
      .limit(1);
    refuseNonDemoAccounts(real ? 1 : 0);
    // Cascade : toutes les données scopées par user_id partent avec le compte démo.
    await tx.delete(schema.users).where(eq(schema.users.isDemoAccount, true));
    return seedDemoData(tx);
  });

  // Hors transaction : le script SQL ouvre la sienne (BEGIN … COMMIT).
  const snapshotSql = await readFile(opts.snapshotSqlPath, 'utf8');
  await sql.unsafe(snapshotSql); // guardrail-allow: script SQL versionné du dépôt (scripts/demo-seed-snapshot.sql), aucune entrée externe
  return { demoEmail: PREVIEW_DEMO_EMAIL, demoUserId };
}

type SeedTx = Parameters<
  Parameters<ReturnType<typeof drizzle<typeof schema>>['transaction']>[0]
>[0];

const isoDay = (offsetDays: number): string => {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + offsetDays);
  return d.toISOString().slice(0, 10);
};

/** Foyer fictif, en clair (compte démo non chiffré) : noms et montants inventés. */
async function seedDemoData(tx: SeedTx): Promise<string> {
  const [demo] = await tx
    .insert(schema.users)
    .values({
      email: PREVIEW_DEMO_EMAIL,
      displayName: 'Compte démo',
      isDemoAccount: true,
      emailVerified: new Date(),
    })
    .returning({ id: schema.users.id });
  if (!demo) throw new Error('Création du compte démo sans retour');
  const userId = demo.id;

  const [, child] = await tx
    .insert(schema.patients)
    .values([
      { userId, firstName: 'Camille', lastName: 'Martin', color: '#6366f1' },
      {
        userId,
        firstName: 'Léo',
        lastName: 'Martin',
        birthDate: '2018-04-12',
        color: '#f59e0b',
      },
    ])
    .returning({ id: schema.patients.id });
  const [practitioner] = await tx
    .insert(schema.practitioners)
    .values({ userId, name: 'Dr Exemple', type: 'pediatre' })
    .returning({ id: schema.practitioners.id });
  if (!practitioner || !child) throw new Error('Seed démo incomplet');
  await tx.insert(schema.appointments).values({
    userId,
    patientId: child.id,
    practitionerId: practitioner.id,
    date: isoDay(7),
    time: '10:30',
    reason: 'Visite de contrôle',
  });

  const [checking, savings] = await tx
    .insert(schema.bankAccounts)
    .values([
      {
        userId,
        name: 'Compte courant',
        type: 'courant',
        initialBalance: '1500',
      },
      { userId, name: 'Livret A', type: 'épargne', initialBalance: '4000' },
    ])
    .returning({ id: schema.bankAccounts.id });
  if (!checking || !savings) throw new Error('Seed démo incomplet');
  await tx.insert(schema.accountTransactions).values([
    {
      userId,
      accountId: checking.id,
      amount: '2100',
      direction: 'income',
      date: isoDay(-10),
      category: 'Salaire',
    },
    {
      userId,
      accountId: checking.id,
      amount: '84.20',
      direction: 'expense',
      date: isoDay(-3),
      category: 'Courses',
    },
    {
      userId,
      accountId: checking.id,
      toAccountId: savings.id,
      amount: '200',
      direction: 'transfer',
      date: isoDay(-1),
      note: 'Épargne du mois',
    },
  ]);
  await tx.insert(schema.envelopes).values({
    userId,
    name: 'Vacances d’été',
    type: 'vacances',
    balance: '350',
    target: '1200',
  });
  return userId;
}
