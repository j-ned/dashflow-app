import { describe, it, expect, afterAll } from 'vitest';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import * as schema from '../src/db/schema';
import { AuthRepository } from '../src/auth/auth.repository';

// Anti-rejeu TOTP : un pas de temps (30 s) ne sert qu'une fois, même si deux requêtes présentent
// le même code au même instant (code intercepté pendant la connexion de la victime).
const sql = postgres(process.env.DATABASE_URL ?? '');
const repo = new AuthRepository(drizzle(sql, { schema }));

async function account(): Promise<string> {
  const [row] = await sql<{ id: string }[]>`
    insert into users (email, password, email_verified)
    values (${`totp+${Date.now()}-${Math.random()}@dashflow.test`}, 'x', now())
    returning id`;
  if (!row) throw new Error('compte de test non créé');
  return row.id;
}

describe('AuthRepository.claimTotpStep (intégration DB)', () => {
  afterAll(async () => {
    await sql.end();
  });

  it('même pas présenté 5 fois en même temps : une seule revendication réussit', async () => {
    const id = await account();

    const results = await Promise.all(
      Array.from({ length: 5 }, () => repo.claimTotpStep(id, 1_000)),
    );

    expect(results.filter(Boolean)).toHaveLength(1);
  });

  it('pas déjà consommé ou plus ancien : refusé ; pas suivant : accepté', async () => {
    const id = await account();
    expect(await repo.claimTotpStep(id, 2_000)).toBe(true);

    expect(await repo.claimTotpStep(id, 2_000)).toBe(false);
    expect(await repo.claimTotpStep(id, 1_999)).toBe(false);
    expect(await repo.claimTotpStep(id, 2_001)).toBe(true);
  });
});
