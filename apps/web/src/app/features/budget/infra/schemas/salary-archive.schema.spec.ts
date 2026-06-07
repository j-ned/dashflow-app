import { describe, expect, it } from 'vitest';
import * as z from 'zod/mini';
import { SalaryArchiveSchema } from './salary-archive.schema';

const VALID = {
  id: 's1',
  accountId: null,
  month: '2026-05',
  salary: 2000,
  totalExpenses: 1200,
  totalSpendings: 300,
  spendings: [{ label: 'Resto', amount: 30, date: '2026-05-04', category: null }],
  payslipKey: null,
};

describe('SalaryArchiveSchema', () => {
  it('accepte une archive conforme', () => {
    expect(z.safeParse(SalaryArchiveSchema, VALID).success).toBe(true);
  });
  it('accepte un tableau spendings vide', () => {
    expect(z.safeParse(SalaryArchiveSchema, { ...VALID, spendings: [] }).success).toBe(true);
  });
  it('rejette un spending mal formé', () => {
    expect(
      z.safeParse(SalaryArchiveSchema, { ...VALID, spendings: [{ label: 'x' }] }).success,
    ).toBe(false);
  });
});
