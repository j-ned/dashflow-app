import { describe, expect, it } from 'vitest';
import { isEntryActive, isSpendingInMonth, monthlyBreakdown } from './analytics-monthly';
import { RecurringEntry } from './models/recurring-entry.model';

const M = '2026-06';
const e = (p: Partial<RecurringEntry>): RecurringEntry => ({
  id: 'x',
  memberId: null,
  accountId: null,
  toAccountId: null,
  label: '',
  amount: 0,
  type: 'expense',
  dayOfMonth: null,
  date: null,
  endDate: null,
  category: null,
  payslipKey: null,
  autoPost: false,
  autoPostSince: null,
  ...p,
});

describe('isEntryActive', () => {
  it('true sans endDate, true si endDate >= mois, false si endDate passée', () => {
    expect(isEntryActive(e({ endDate: null }), M)).toBe(true);
    expect(isEntryActive(e({ endDate: '2026-06-30' }), M)).toBe(true);
    expect(isEntryActive(e({ endDate: '2026-05-31' }), M)).toBe(false);
  });
});

describe('isSpendingInMonth', () => {
  it('true sans date, true si date du mois, false sinon', () => {
    expect(isSpendingInMonth(e({ date: null }), M)).toBe(true);
    expect(isSpendingInMonth(e({ date: '2026-06-05' }), M)).toBe(true);
    expect(isSpendingInMonth(e({ date: '2026-05-05' }), M)).toBe(false);
  });
});

describe('monthlyBreakdown (calibré)', () => {
  it('exclut income/expense terminées et spendings hors mois', () => {
    const b = monthlyBreakdown(
      [
        e({ type: 'income', amount: 2000 }),
        e({ type: 'income', amount: 999, endDate: '2026-05-31' }),
        e({ type: 'expense', amount: 500 }),
        e({ type: 'expense', amount: 111, endDate: '2026-05-31' }),
        e({ type: 'annual_expense', amount: 1200 }),
        e({ type: 'spending', amount: 60, date: '2026-06-10' }),
        e({ type: 'spending', amount: 777, date: '2026-04-10' }),
        e({ type: 'spending', amount: 40, date: null }),
      ],
      M,
    );
    expect(b.income).toBe(2000);
    expect(b.expenses).toBe(500);
    expect(b.annualMonthly).toBe(100);
    expect(b.spendings).toBe(100);
    expect(b.totalCharges).toBe(700);
    expect(b.net).toBe(1300);
  });

  it('envelopeCredits / loanPayments par catégorie (mois courant)', () => {
    const b = monthlyBreakdown(
      [
        e({ type: 'spending', amount: 200, date: '2026-06-01', category: 'Enveloppe' }),
        e({ type: 'spending', amount: 150, date: '2026-06-02', category: 'Remboursement' }),
        e({ type: 'spending', amount: 999, date: '2026-04-02', category: 'Enveloppe' }),
        e({ type: 'spending', amount: 30, date: '2026-06-03', category: 'Alimentation' }),
      ],
      M,
    );
    expect(b.envelopeCredits).toBe(200);
    expect(b.loanPayments).toBe(150);
    expect(b.spendings).toBe(380);
  });
});
