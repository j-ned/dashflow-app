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
} as unknown as AuthRepository;
const enc = new EncryptionService(repo, db);

async function makeUser(): Promise<string> {
  const [u] = await db
    .insert(schema.users)
    .values({
      email: `enc+${Date.now()}-${Math.floor(Math.random() * 1e6)}@dashflow.test`,
      password: 'x',
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

  it('wipe : supprime les lignes + reset état', async () => {
    const userId = await makeUser();
    await db
      .insert(schema.bankAccounts)
      .values({ userId, name: 'X', initialBalance: '0' });
    await enc.wipe(userId);
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
  });
});
