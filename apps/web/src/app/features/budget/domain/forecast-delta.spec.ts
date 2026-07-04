import { describe, expect, it } from 'vitest';
import { RecurringEntry } from './models/recurring-entry.model';
import { AccountTransaction } from './models/account-transaction.model';
import { computeForecastDelta } from './forecast-delta';

function re(id: string, amount: number): RecurringEntry {
  return {
    id,
    memberId: null,
    accountId: 'a',
    toAccountId: null,
    label: 'l',
    amount,
    type: 'expense',
    dayOfMonth: 5,
    date: null,
    endDate: null,
    category: null,
    payslipKey: null,
    autoPost: false,
    autoPostSince: null,
  };
}

const EMPTY = {
  incomes: [],
  monthlyExpenses: [],
  annualExpenses: [],
  monthSpendings: [],
  incomingTransfers: [],
  outgoingTransfers: [],
  oneTimeIncoming: 0,
  oneTimeOutgoing: 0,
  txs: [] as AccountTransaction[],
  currentMonth: '2026-06',
};

describe('computeForecastDelta', () => {
  it('ensemble vide → 0', () => {
    expect(computeForecastDelta(EMPTY)).toBe(0);
  });

  it('formule : inc + in − exp − ann − spend − out', () => {
    const delta = computeForecastDelta({
      ...EMPTY,
      incomes: [re('i', 2000)],
      monthlyExpenses: [re('e', 800)],
      annualExpenses: [re('a', 1200)],
      monthSpendings: [re('s', 50)],
      incomingTransfers: [re('it', 30)],
      outgoingTransfers: [re('ot', 200)],
      oneTimeIncoming: 10,
      oneTimeOutgoing: 5,
    });
    // 2000 + (30 + 10) − 800 − 100 − 50 − (200 + 5) = 885
    expect(delta).toBe(885);
  });

  it('exclut une entrée déjà postée (tx réconciliée ce mois)', () => {
    const tx: AccountTransaction = {
      id: 't',
      accountId: 'a',
      amount: 800,
      direction: 'expense',
      toAccountId: null,
      date: '2026-06-05',
      category: null,
      note: null,
      memberId: null,
      recurringEntryId: 'e',
    };
    const delta = computeForecastDelta({
      ...EMPTY,
      monthlyExpenses: [re('e', 800)],
      txs: [tx],
      currentMonth: '2026-06',
    });
    expect(delta).toBe(0);
  });

  it('exclut un revenu ponctuel déjà posté même à un mois passé (pas de double comptage)', () => {
    const income: RecurringEntry = {
      id: 'oti',
      memberId: null,
      accountId: 'a',
      toAccountId: null,
      label: 'Prime',
      amount: 1500,
      type: 'income',
      dayOfMonth: null,
      date: '2026-05-20',
      endDate: null,
      category: null,
      payslipKey: null,
      autoPost: false,
      autoPostSince: null,
    };
    const tx: AccountTransaction = {
      id: 't',
      accountId: 'a',
      amount: 1500,
      direction: 'income',
      toAccountId: null,
      date: '2026-05-20',
      category: null,
      note: null,
      memberId: null,
      recurringEntryId: 'oti',
    };
    const delta = computeForecastDelta({
      ...EMPTY,
      incomes: [income],
      txs: [tx],
      currentMonth: '2026-06',
    });
    expect(delta).toBe(0);
  });

  it('projette encore un revenu récurrent dont seule une échéance d’un mois passé est postée', () => {
    const income: RecurringEntry = { ...re('ri', 2000), type: 'income', dayOfMonth: 5 };
    const txMay: AccountTransaction = {
      id: 't',
      accountId: 'a',
      amount: 2000,
      direction: 'income',
      toAccountId: null,
      date: '2026-05-05',
      category: null,
      note: null,
      memberId: null,
      recurringEntryId: 'ri',
    };
    const delta = computeForecastDelta({
      ...EMPTY,
      incomes: [income],
      txs: [txMay],
      currentMonth: '2026-06',
    });
    expect(delta).toBe(2000);
  });
});
