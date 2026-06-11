import { normalizeRecurringEntry } from './recurring-entry.adapter';

const base = {
  id: 'r1',
  memberId: null,
  accountId: 'a',
  toAccountId: null,
  label: 'Loyer',
  amount: 800,
  type: 'expense' as const,
  dayOfMonth: 5,
  date: null,
  endDate: null,
  category: null,
  payslipKey: null,
};

describe('normalizeRecurringEntry', () => {
  it('applique autoPost=false et autoPostSince=null quand absents (récurrence existante)', () => {
    const result = normalizeRecurringEntry({ ...base } as never);
    expect(result.autoPost).toBe(false);
    expect(result.autoPostSince).toBeNull();
  });

  it('préserve les valeurs présentes', () => {
    const result = normalizeRecurringEntry({
      ...base,
      autoPost: true,
      autoPostSince: '2026-05',
    } as never);
    expect(result.autoPost).toBe(true);
    expect(result.autoPostSince).toBe('2026-05');
  });

  it('coerce amount string→number (numeric Postgres en clair, ex. compte démo)', () => {
    const result = normalizeRecurringEntry({ ...base, amount: '2850.00' } as never);
    expect(result.amount).toBe(2850);
    expect(typeof result.amount).toBe('number');
  });

  it('préserve un amount déjà numérique (compte chiffré)', () => {
    const result = normalizeRecurringEntry({ ...base, amount: 800 } as never);
    expect(result.amount).toBe(800);
  });
});
