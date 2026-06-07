import { describe, expect, it } from 'vitest';
import { RecurringEntry } from './models/recurring-entry.model';
import { AccountTransaction } from './models/account-transaction.model';
import { buildPendingCharges } from './pending-charges';

function re(over: Partial<RecurringEntry>): RecurringEntry {
  return {
    id: 'x',
    memberId: null,
    accountId: 'a',
    toAccountId: null,
    label: 'l',
    amount: 100,
    type: 'expense',
    dayOfMonth: 5,
    date: null,
    endDate: null,
    category: null,
    payslipKey: null,
    autoPost: false,
    autoPostSince: null,
    ...over,
  };
}

const BASE = {
  incomes: [] as RecurringEntry[],
  monthlyExpenses: [] as RecurringEntry[],
  recurringTransfers: [] as RecurringEntry[],
  ignored: new Set<string>(),
  salaryDay: 5,
  currentDay: 20,
  currentMonth: '2026-06',
  txs: [] as AccountTransaction[],
};

describe('buildPendingCharges', () => {
  it('inclut une dépense éligible et calcule direction/date/montant', () => {
    const out = buildPendingCharges({
      ...BASE,
      monthlyExpenses: [re({ id: 'e', dayOfMonth: 5, amount: 80 })],
    });
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({
      direction: 'expense',
      suggestedDate: '2026-06-05',
      suggestedAmount: 80,
    });
  });

  it('mappe direction selon le type', () => {
    const inc = buildPendingCharges({ ...BASE, incomes: [re({ id: 'i', type: 'income' })] })[0];
    const tr = buildPendingCharges({
      ...BASE,
      recurringTransfers: [re({ id: 't', type: 'transfer' })],
    })[0];
    expect(inc.direction).toBe('income');
    expect(tr.direction).toBe('transfer');
  });

  it.each([
    ['accountId null', re({ accountId: null })],
    ['dayOfMonth null', re({ dayOfMonth: null })],
    ['autoPost true', re({ autoPost: true })],
    ['non passé (jour 25, today 20, salaire 5)', re({ dayOfMonth: 25 })],
  ])('exclut : %s', (_label, entry) => {
    expect(buildPendingCharges({ ...BASE, monthlyExpenses: [entry] })).toHaveLength(0);
  });

  it('exclut une entrée ignorée', () => {
    expect(
      buildPendingCharges({ ...BASE, monthlyExpenses: [re({ id: 'e' })], ignored: new Set(['e']) }),
    ).toHaveLength(0);
  });

  it('exclut une entrée déjà postée', () => {
    const tx: AccountTransaction = {
      id: 't',
      accountId: 'a',
      amount: 100,
      direction: 'expense',
      toAccountId: null,
      date: '2026-06-05',
      category: null,
      note: null,
      memberId: null,
      recurringEntryId: 'e',
    };
    expect(
      buildPendingCharges({ ...BASE, monthlyExpenses: [re({ id: 'e' })], txs: [tx] }),
    ).toHaveLength(0);
  });
});
