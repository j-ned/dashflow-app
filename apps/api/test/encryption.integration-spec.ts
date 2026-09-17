import { describe, it, expect, afterAll } from 'vitest';
// DATABASE_URL is injected via vitest.integration.config.ts → test.env
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { eq } from 'drizzle-orm';
import * as schema from '../src/db/schema';
import { EncryptionService } from '../src/auth/encryption.service';
import type { AuthRepository } from '../src/auth/auth.repository';

const sql = postgres(process.env.DATABASE_URL!);
const db = drizzle(sql, { schema });
const repo = {
  updateUser: async (
    id: string,
    patch: Partial<typeof schema.users.$inferInsert>,
  ) => {
    await db.update(schema.users).set(patch).where(eq(schema.users.id, id));
    return undefined;
  },
  findById: (id: string) =>
    db
      .select()
      .from(schema.users)
      .where(eq(schema.users.id, id))
      .then((r) => r[0]),
  findByEmail: (email: string) =>
    db
      .select()
      .from(schema.users)
      .where(eq(schema.users.email, email))
      .then((r) => r[0]),
  findValidCode: () => Promise.resolve({ id: 'code' }),
  bumpSessionVersion: () => Promise.resolve(undefined),
  deleteCodes: () => Promise.resolve(undefined),
} as unknown as AuthRepository;
const enc = new EncryptionService(repo, db);

async function makeUser(
  extra: Partial<typeof schema.users.$inferInsert> = {},
): Promise<string> {
  const [u] = await db
    .insert(schema.users)
    .values({
      email: `enc+${Date.now()}-${Math.floor(Math.random() * 1e6)}@dashflow.test`,
      password: 'x',
      ...extra,
    })
    .returning();
  return u.id;
}

describe('EncryptionService intégration', () => {
  afterAll(async () => {
    await sql.end();
  });

  it('migrate : écrit encryptedData + clear name sur bankAccounts', async () => {
    const userId = await makeUser();
    const [acc] = await db
      .insert(schema.bankAccounts)
      .values({ userId, name: 'Compte courant', initialBalance: '100' })
      .returning();
    await enc.migrate(userId, {
      keyMaterial: {
        salt: 's',
        wrappedMasterKey: 'w',
        recoveryWrappedKey: 'r',
      },
      data: { bankAccounts: [{ id: acc.id, encryptedData: 'ENC' }] },
    });
    const [after] = await db
      .select()
      .from(schema.bankAccounts)
      .where(eq(schema.bankAccounts.id, acc.id));
    expect(after.encryptedData).toBe('ENC');
    expect(after.name).toBe('[chiffré]');
    const [user] = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.id, userId));
    expect(user.encryptionVersion).toBe(1);
  });

  it('migrate : account_transactions est migrée (amount/date/category/note neutralisés)', async () => {
    const userId = await makeUser();
    const [acc] = await db
      .insert(schema.bankAccounts)
      .values({ userId, name: 'C', initialBalance: '0' })
      .returning();
    const [tx] = await db
      .insert(schema.accountTransactions)
      .values({
        userId,
        accountId: acc.id,
        amount: '42.50',
        direction: 'expense',
        date: '2026-03-01',
        category: 'Courses',
        note: 'secret',
      })
      .returning();
    await enc.migrate(userId, {
      keyMaterial: {
        salt: 's',
        wrappedMasterKey: 'w',
        recoveryWrappedKey: 'r',
      },
      data: { accountTransactions: [{ id: tx.id, encryptedData: 'ENC-TX' }] },
    });
    const [after] = await db
      .select()
      .from(schema.accountTransactions)
      .where(eq(schema.accountTransactions.id, tx.id));
    expect(after.encryptedData).toBe('ENC-TX');
    expect(after.amount).toBe('0.00');
    expect(after.date).toBe('1970-01-01');
    expect(after.category).toBeNull();
    expect(after.note).toBeNull();
  });

  it('migrate : un mouvement d’enveloppe d’un AUTRE foyer n’est jamais réécrit (scope via le parent)', async () => {
    const victim = await makeUser();
    const attacker = await makeUser();
    const [env] = await db
      .insert(schema.envelopes)
      .values({ userId: victim, name: 'Vacances', type: 'épargne' })
      .returning();
    const [mvt] = await db
      .insert(schema.envelopeTransactions)
      .values({ envelopeId: env.id, amount: '100', date: '2026-01-01' })
      .returning();
    await enc.migrate(attacker, {
      keyMaterial: {
        salt: 's',
        wrappedMasterKey: 'w',
        recoveryWrappedKey: 'r',
      },
      data: { envelopeTransactions: [{ id: mvt.id, encryptedData: 'PWNED' }] },
    });
    const [after] = await db
      .select()
      .from(schema.envelopeTransactions)
      .where(eq(schema.envelopeTransactions.id, mvt.id));
    expect(after.encryptedData).toBeNull();
    expect(after.amount).toBe('100.00');
  });

  it('migrate : tout ou rien — une ligne invalide annule la transaction et laisse encryption_version = 0', async () => {
    const userId = await makeUser();
    const [acc] = await db
      .insert(schema.bankAccounts)
      .values({ userId, name: 'C', initialBalance: '0' })
      .returning();
    await expect(
      enc.migrate(userId, {
        keyMaterial: {
          salt: 's',
          wrappedMasterKey: 'w',
          recoveryWrappedKey: 'r',
        },
        data: {
          bankAccounts: [{ id: acc.id, encryptedData: 'ENC' }],
          envelopes: [{ id: 'pas-un-uuid', encryptedData: 'ENC' }],
        },
      }),
    ).rejects.toBeDefined();
    const [account] = await db
      .select()
      .from(schema.bankAccounts)
      .where(eq(schema.bankAccounts.id, acc.id));
    expect(account.encryptedData).toBeNull();
    expect(account.name).toBe('C');
    const [user] = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.id, userId));
    expect(user.encryptionVersion).toBe(0);
  });

  it('migrate : refusée (409) sur un compte déjà chiffré, clés intactes', async () => {
    const userId = await makeUser({
      encryptionVersion: 1,
      encryptionSalt: 'old-s',
      wrappedMasterKey: 'old-w',
      recoveryWrappedKey: 'old-r',
    });
    const res = await enc.migrate(userId, {
      keyMaterial: {
        salt: 's',
        wrappedMasterKey: 'w',
        recoveryWrappedKey: 'r',
      },
      data: {},
    });
    expect(res).toMatchObject({ success: false, status: 409 });
    const [user] = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.id, userId));
    expect(user.wrappedMasterKey).toBe('old-w');
  });

  it('reset avec effacement : supprime les lignes, remet les clés à zéro et change le mot de passe', async () => {
    const userId = await makeUser({
      encryptionVersion: 1,
      encryptionSalt: 's',
      wrappedMasterKey: 'w',
      recoveryWrappedKey: 'r',
    });
    await db
      .insert(schema.bankAccounts)
      .values({ userId, name: 'X', initialBalance: '0' });
    const [{ email }] = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.id, userId));
    const res = await enc.resetPasswordWithRecovery({
      email,
      code: '123456',
      newPassword: 'nouveau-long-123',
      wipe: true,
    });
    expect(res.success).toBe(true);
    const rows = await db
      .select()
      .from(schema.bankAccounts)
      .where(eq(schema.bankAccounts.userId, userId));
    expect(rows).toHaveLength(0);
    const [user] = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.id, userId));
    expect(user.encryptionVersion).toBe(0);
    expect(user.wrappedMasterKey).toBeNull();
    expect(user.password).not.toBe('x');
  });
});
