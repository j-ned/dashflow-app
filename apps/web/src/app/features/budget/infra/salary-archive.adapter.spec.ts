import { describe, it, expect } from 'vitest';
import { normalizeSalaryArchive } from './salary-archive.adapter';

const CLEARTEXT_API_ARCHIVE = {
  id: 'sa-1',
  accountId: 'acc-1',
  month: '2026-06',
  salary: '2100.00',
  totalExpenses: '200.00',
  totalSpendings: '50.00',
  spendings: [{ label: 'Courses', amount: '12.50', date: '2026-06-10', category: 'food' }],
  payslipKey: null,
};

describe('normalizeSalaryArchive', () => {
  it('coerce salary/totalExpenses/totalSpendings string→number (numeric Postgres en clair, ex. compte démo)', () => {
    const result = normalizeSalaryArchive({ ...CLEARTEXT_API_ARCHIVE } as never);

    expect(result.salary).toBe(2100);
    expect(result.totalExpenses).toBe(200);
    expect(result.totalSpendings).toBe(50);
    expect(typeof result.salary).toBe('number');
    expect(typeof result.totalExpenses).toBe('number');
    expect(typeof result.totalSpendings).toBe('number');
  });

  it('coerce spendings[].amount string→number', () => {
    const result = normalizeSalaryArchive({ ...CLEARTEXT_API_ARCHIVE } as never);

    expect(result.spendings[0].amount).toBe(12.5);
    expect(typeof result.spendings[0].amount).toBe('number');
  });

  it('préserve des valeurs déjà numériques (compte chiffré, idempotent)', () => {
    const alreadyNumeric = {
      ...CLEARTEXT_API_ARCHIVE,
      salary: 2100,
      totalExpenses: 200,
      totalSpendings: 50,
      spendings: [{ label: 'Courses', amount: 12.5, date: '2026-06-10', category: 'food' }],
    };

    const result = normalizeSalaryArchive({ ...alreadyNumeric } as never);

    expect(result.salary).toBe(2100);
    expect(result.totalExpenses).toBe(200);
    expect(result.totalSpendings).toBe(50);
    expect(result.spendings[0].amount).toBe(12.5);
  });

  it('renvoie [] quand spendings est absent', () => {
    const { spendings, ...withoutSpendings } = CLEARTEXT_API_ARCHIVE;
    const result = normalizeSalaryArchive({ ...withoutSpendings } as never);

    expect(result.spendings).toEqual([]);
  });

  it('renvoie [] quand spendings est vide', () => {
    const result = normalizeSalaryArchive({ ...CLEARTEXT_API_ARCHIVE, spendings: [] } as never);

    expect(result.spendings).toEqual([]);
  });
});
