import { describe, expect, it } from 'vitest';
import * as z from 'zod/mini';
import { RecurringEntrySchema } from './recurring-entry.schema';

const VALID = {
  id: 'r1',
  memberId: null,
  accountId: 'a',
  toAccountId: null,
  label: 'Loyer',
  amount: 800,
  type: 'expense',
  dayOfMonth: 5,
  date: null,
  endDate: null,
  category: null,
  payslipKey: null,
  autoPost: false,
  autoPostSince: null,
};

describe('RecurringEntrySchema', () => {
  it('accepte une récurrence conforme', () => {
    expect(z.safeParse(RecurringEntrySchema, VALID).success).toBe(true);
  });
  it('rejette un type inconnu', () => {
    expect(z.safeParse(RecurringEntrySchema, { ...VALID, type: 'loan' }).success).toBe(false);
  });
  it('rejette un autoPost non booléen', () => {
    expect(z.safeParse(RecurringEntrySchema, { ...VALID, autoPost: 'yes' }).success).toBe(false);
  });
});
