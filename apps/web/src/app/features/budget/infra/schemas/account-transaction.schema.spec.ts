import { describe, expect, it } from 'vitest';
import * as z from 'zod/mini';
import { AccountTransactionSchema } from './account-transaction.schema';

const VALID = {
  id: 't1',
  accountId: 'a',
  amount: 12.5,
  direction: 'expense',
  toAccountId: null,
  date: '2026-06-01',
  category: null,
  note: null,
  memberId: null,
  recurringEntryId: null,
};

describe('AccountTransactionSchema', () => {
  it('accepte une transaction conforme', () => {
    expect(z.safeParse(AccountTransactionSchema, VALID).success).toBe(true);
  });
  it('rejette un amount non numérique', () => {
    expect(z.safeParse(AccountTransactionSchema, { ...VALID, amount: '12.5' }).success).toBe(false);
  });
  it('rejette une direction inconnue', () => {
    expect(z.safeParse(AccountTransactionSchema, { ...VALID, direction: 'gift' }).success).toBe(
      false,
    );
  });
});
