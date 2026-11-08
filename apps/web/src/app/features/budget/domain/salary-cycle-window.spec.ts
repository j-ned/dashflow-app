import { describe, expect, it } from 'vitest';
import { RecurringEntry } from './models/recurring-entry.model';
import { AccountTransaction } from './models/account-transaction.model';
import { cycleIncome, occurrenceIn, salaryCycleWindow } from './salary-cycle-window';

function entry(over: Partial<RecurringEntry>): RecurringEntry {
  return {
    id: 'e',
    memberId: null,
    accountId: 'a',
    toAccountId: null,
    label: 'l',
    amount: 100,
    type: 'expense',
    dayOfMonth: null,
    date: null,
    endDate: null,
    category: null,
    payslipKey: null,
    autoPost: false,
    autoPostSince: null,
    variableAmount: false,
    ...over,
  };
}

function tx(recurringEntryId: string, date: string, amount: number): AccountTransaction {
  return {
    id: `t-${recurringEntryId}-${date}`,
    accountId: 'a',
    amount,
    direction: 'income',
    toAccountId: null,
    date,
    category: null,
    note: null,
    memberId: null,
    recurringEntryId,
  };
}

describe('salaryCycleWindow', () => {
  it.each([
    // [aujourd'hui, jour de salaire, début, fin]
    ['2026-11-08', 30, '2026-10-30', '2026-11-29'], // salaire du 30 octobre → veille du 30 novembre
    ['2026-11-30', 30, '2026-11-30', '2026-12-29'], // jour de paie : le nouveau cycle commence
    ['2026-11-29', 30, '2026-10-30', '2026-11-29'], // veille de paie : dernier jour du cycle
    ['2026-11-08', 1, '2026-11-01', '2026-11-30'], // salaire le 1er : le mois civil
    ['2027-02-10', 30, '2027-01-30', '2027-02-27'], // février : la paie tombe le 28
    ['2027-02-28', 30, '2027-02-28', '2027-03-29'],
    ['2026-04-30', 31, '2026-04-30', '2026-05-30'], // avril n'a pas de 31 : paie le 30
    ['2026-12-15', 30, '2026-11-30', '2026-12-29'],
    ['2027-01-05', 30, '2026-12-30', '2027-01-29'], // à cheval sur l'année
  ])('le %s avec un salaire le %i : du %s au %s', (today, salaryDay, start, end) => {
    expect(salaryCycleWindow(today, salaryDay)).toEqual({ start, end });
  });
});

describe('occurrenceIn', () => {
  const cycle = { start: '2026-10-30', end: '2026-11-29' };

  it.each([
    [5, '2026-11-05'],
    [29, '2026-11-29'],
    [30, '2026-10-30'], // le 30 octobre ouvre le cycle
    [31, '2026-10-31'],
  ])('récurrence du %i → échéance du %s dans le cycle', (dayOfMonth, expected) => {
    expect(occurrenceIn(entry({ dayOfMonth }), cycle)).toBe(expected);
  });

  it('opération datée : comptée seulement si sa date tombe dans le cycle', () => {
    expect(occurrenceIn(entry({ date: '2026-11-12' }), cycle)).toBe('2026-11-12');
    expect(occurrenceIn(entry({ date: '2026-11-30' }), cycle)).toBeNull();
    expect(occurrenceIn(entry({ date: '2026-10-29' }), cycle)).toBeNull();
  });
});

describe('cycleIncome', () => {
  const cycle = { start: '2026-10-30', end: '2026-11-29' };
  const salary = entry({ id: 's', type: 'income', dayOfMonth: 30, variableAmount: true });

  it('salaire du début de cycle saisi : le montant réellement reçu, revenus complets', () => {
    expect(cycleIncome([salary], [tx('s', '2026-10-30', 2321)], cycle)).toEqual({
      total: 2321,
      incomplete: false,
    });
  });

  it('salaire variable pas encore saisi : rien d’inventé, revenus incomplets', () => {
    expect(cycleIncome([salary], [], cycle)).toEqual({ total: 0, incomplete: true });
  });

  it('le salaire du cycle suivant (30 novembre) ne compte pas dans celui-ci', () => {
    const txs = [tx('s', '2026-10-30', 2321), tx('s', '2026-11-30', 2400)];

    expect(cycleIncome([salary], txs, cycle).total).toBe(2321);
  });

  it('revenu fixe non saisi : le montant prévu', () => {
    const fixed = entry({ id: 'f', type: 'income', dayOfMonth: 10, amount: 300 });

    expect(cycleIncome([fixed], [], cycle)).toEqual({ total: 300, incomplete: false });
  });
});
