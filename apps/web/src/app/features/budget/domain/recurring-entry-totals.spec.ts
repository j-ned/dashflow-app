import { describe, expect, it } from 'vitest';
import { RecurringEntry } from './models/recurring-entry.model';
import { sumAmount } from './recurring-entry-totals';

function e(amount: number): RecurringEntry {
  return {
    id: 'x', memberId: null, accountId: 'a', toAccountId: null, label: 'l', amount,
    type: 'expense', dayOfMonth: 1, date: null, endDate: null, category: null,
    payslipKey: null, autoPost: false, autoPostSince: null,
  };
}

describe('sumAmount', () => {
  it('renvoie 0 pour une liste vide', () => {
    expect(sumAmount([])).toBe(0);
  });
  it('somme les montants', () => {
    expect(sumAmount([e(10), e(5.5), e(0.5)])).toBe(16);
  });
});
