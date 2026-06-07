import { describe, expect, it } from 'vitest';
import * as z from 'zod/mini';
import { LoanSchema } from './loan.schema';

const VALID = {
  id: 'l1',
  memberId: null,
  person: 'Paul',
  direction: 'lent',
  amount: 100,
  remaining: 50,
  description: 'x',
  date: '2026-01-01',
  dueDate: null,
  dueDay: null,
};

describe('LoanSchema', () => {
  it('accepte un prêt conforme', () => {
    expect(z.safeParse(LoanSchema, VALID).success).toBe(true);
  });
  it('rejette une direction inconnue', () => {
    expect(z.safeParse(LoanSchema, { ...VALID, direction: 'given' }).success).toBe(false);
  });
  it('rejette un remaining non numérique', () => {
    expect(z.safeParse(LoanSchema, { ...VALID, remaining: '50' }).success).toBe(false);
  });
});
