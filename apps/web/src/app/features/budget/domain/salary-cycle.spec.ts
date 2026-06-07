import { describe, expect, it } from 'vitest';
import { RecurringEntry } from './models/recurring-entry.model';
import { isExpensePassed } from './salary-cycle';

function entry(dayOfMonth: number | null): RecurringEntry {
  return {
    id: 'x', memberId: null, accountId: 'a', toAccountId: null, label: 'l', amount: 1,
    type: 'expense', dayOfMonth, date: null, endDate: null, category: null,
    payslipKey: null, autoPost: false, autoPostSince: null,
  };
}

describe('isExpensePassed', () => {
  it.each([
    [5, 5, 20, true],
    [20, 5, 20, true],
    [4, 5, 20, false],
    [21, 5, 20, false],
  ])('intra-mois day=%i salary=%i today=%i → %s', (day, salary, today, expected) => {
    expect(isExpensePassed(entry(day), salary, today)).toBe(expected);
  });

  it.each([
    [25, 25, 3, true],
    [26, 25, 3, true],
    [1, 25, 3, true],
    [3, 25, 3, true],
    [4, 25, 3, false],
    [24, 25, 3, false],
  ])('cheval day=%i salary=%i today=%i → %s', (day, salary, today, expected) => {
    expect(isExpensePassed(entry(day), salary, today)).toBe(expected);
  });

  it('dayOfMonth null est traité comme le 1er', () => {
    expect(isExpensePassed(entry(null), 25, 3)).toBe(true);
    expect(isExpensePassed(entry(null), 5, 20)).toBe(false);
  });
});
