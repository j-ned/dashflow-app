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
    variableAmount: false,
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

  it('mappe direction income', () => {
    const inc = buildPendingCharges({ ...BASE, incomes: [re({ id: 'i', type: 'income' })] })[0];
    expect(inc.direction).toBe('income');
  });

  it('exclut les virements récurrents (toujours auto, jamais à confirmer)', () => {
    const out = buildPendingCharges({
      ...BASE,
      recurringTransfers: [re({ id: 't', type: 'transfer', toAccountId: 'b', autoPost: false })],
    });
    expect(out).toEqual([]);
  });

  it('inclut toujours une dépense non auto-pointée éligible (non-régression)', () => {
    const out = buildPendingCharges({ ...BASE, monthlyExpenses: [re({ id: 'e', dayOfMonth: 5 })] });
    expect(out).toHaveLength(1);
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

  describe('mois de l’échéance', () => {
    const SALARY = re({ id: 'sal', type: 'income', dayOfMonth: 28, amount: 2100 });
    const RENT = re({ id: 'rent', dayOfMonth: 5 });
    const tx = (recurringEntryId: string, date: string): AccountTransaction => ({
      id: 't',
      accountId: 'a',
      amount: 1,
      direction: 'income',
      toAccountId: null,
      date,
      category: null,
      note: null,
      memberId: null,
      recurringEntryId,
    });
    const at = (currentDay: number, txs: AccountTransaction[] = []) =>
      buildPendingCharges({
        ...BASE,
        incomes: [SALARY],
        monthlyExpenses: [RENT],
        salaryDay: 28,
        currentDay,
        currentMonth: '2026-09',
        txs,
      });

    it('le 20 : le salaire du 28 août non saisi est proposé à SA date, jamais au 28 septembre', () => {
      const salary = at(20).find((c) => c.entry.id === 'sal');

      expect(salary?.suggestedDate).toBe('2026-08-28');
    });

    it('le 20 : salaire d’août déjà saisi → plus rien à saisir avant le 28', () => {
      const charges = at(20, [tx('sal', '2026-08-28')]);

      expect(charges.map((c) => c.entry.id)).toEqual(['rent']);
    });

    it('le 29 : le salaire de septembre est dû, et le loyer du 5 non confirmé le reste', () => {
      const charges = at(29, [tx('sal', '2026-08-28')]);

      expect(charges.map((c) => [c.entry.id, c.suggestedDate])).toEqual([
        ['sal', '2026-09-28'],
        ['rent', '2026-09-05'],
      ]);
    });

    it('aucune date proposée n’est dans le futur', () => {
      for (const day of [1, 4, 5, 20, 27, 28, 30]) {
        for (const c of at(day))
          expect(c.suggestedDate <= `2026-09-${String(day).padStart(2, '0')}`).toBe(true);
      }
    });

    it('échéance le 31 rattachée à un mois de 30 jours : ramenée au dernier jour', () => {
      const charges = buildPendingCharges({
        ...BASE,
        monthlyExpenses: [re({ id: 'eom', dayOfMonth: 31 })],
        salaryDay: 31,
        currentDay: 3,
        currentMonth: '2026-10',
      });

      expect(charges[0].suggestedDate).toBe('2026-09-30');
    });
  });
});
