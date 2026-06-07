import { describe, expect, it } from 'vitest';
import * as z from 'zod/mini';
import { BankAccountSchema } from './bank-account.schema';

const VALID = { id: 'a', name: 'Courant', type: 'courant', initialBalance: 100, color: null, dotColor: null };

describe('BankAccountSchema', () => {
  it('accepte un compte conforme', () => {
    expect(z.safeParse(BankAccountSchema, VALID).success).toBe(true);
  });
  it('tolère une clé en trop (forward-compat)', () => {
    expect(z.safeParse(BankAccountSchema, { ...VALID, extra: 1 }).success).toBe(true);
  });
  it('rejette un champ requis manquant', () => {
    const { name: _omit, ...rest } = VALID;
    expect(z.safeParse(BankAccountSchema, rest).success).toBe(false);
  });
  it('rejette un type d\'enum inconnu', () => {
    expect(z.safeParse(BankAccountSchema, { ...VALID, type: 'crypto' }).success).toBe(false);
  });
});
