import { describe, expect, it } from 'vitest';
import { RecurringEntry } from './models/recurring-entry.model';
import { AccountTransaction } from './models/account-transaction.model';
import { computeForecast, computeForecastDelta } from './forecast-delta';

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
    variableAmount: false,
    skippedMonths: [],
  };
}

const EMPTY = {
  incomes: [],
  monthlyExpenses: [],
  annualExpenses: [],
  spendings: [],
  incomingTransfers: [],
  outgoingTransfers: [],
  oneTimeIncoming: [],
  oneTimeOutgoing: [],
  txs: [] as AccountTransaction[],
  cycle: { start: '2026-06-01', end: '2026-06-30' },
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
      spendings: [{ ...re('s', 50), type: 'spending', dayOfMonth: null, date: '2026-06-12' }],
      incomingTransfers: [re('it', 30)],
      outgoingTransfers: [re('ot', 200)],
      oneTimeIncoming: [{ ...re('oti', 10), dayOfMonth: null, date: '2026-06-20' }],
      oneTimeOutgoing: [{ ...re('oto', 5), dayOfMonth: null, date: '2026-06-21' }],
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
      variableAmount: false,
      skippedMonths: [],
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
    });
    expect(delta).toBe(2000);
  });
});

describe('computeForecast : cycle de salaire (paie le 30 pour le mois suivant)', () => {
  // Le 8 novembre : le cycle va du 30 octobre (paie reçue) au 29 novembre (veille de la paie).
  const CYCLE = { start: '2026-10-30', end: '2026-11-29' };
  const salary: RecurringEntry = {
    ...re('s', 2300),
    type: 'income',
    dayOfMonth: 30,
    variableAmount: true,
  };
  const paid: AccountTransaction = {
    id: 'tx-s',
    accountId: 'a',
    amount: 2321,
    direction: 'income',
    toAccountId: null,
    date: '2026-10-30',
    category: null,
    note: null,
    memberId: null,
    recurringEntryId: 's',
  };

  it('paie d’octobre saisie : le salaire du 30 novembre n’est pas attendu, projection complète', () => {
    const forecast = computeForecast({ ...EMPTY, cycle: CYCLE, incomes: [salary], txs: [paid] });

    expect(forecast.unknownIncomes).toEqual([]);
    expect(forecast.delta).toBe(0);
  });

  it('paie d’octobre pas encore saisie : c’est elle, et elle seule, qui manque', () => {
    const forecast = computeForecast({ ...EMPTY, cycle: CYCLE, incomes: [salary] });

    expect(forecast.unknownIncomes.map((e) => e.id)).toEqual(['s']);
  });

  it('prélèvement du 30 : celui du 30 octobre (pointé) relève de ce cycle, celui du 30 novembre du suivant', () => {
    const rentPaid: AccountTransaction = {
      ...paid,
      id: 'tx-e30',
      amount: 1000,
      direction: 'expense',
      recurringEntryId: 'e30',
    };
    const forecast = computeForecast({
      ...EMPTY,
      cycle: CYCLE,
      monthlyExpenses: [
        { ...re('e5', 100), dayOfMonth: 5 },
        { ...re('e15', 40), dayOfMonth: 15 },
        { ...re('e30', 1000), dayOfMonth: 30 },
      ],
      txs: [rentPaid],
    });

    expect(forecast.upcomingDebits).toBe(140);
    expect(forecast.delta).toBe(-140);
  });

  it('un prélèvement du 30 octobre déjà pointé n’est plus à venir', () => {
    const rent: RecurringEntry = { ...re('rent', 700), dayOfMonth: 30 };
    const posted: AccountTransaction = {
      ...paid,
      id: 'tx-rent',
      amount: 700,
      direction: 'expense',
      recurringEntryId: 'rent',
    };

    expect(
      computeForecast({ ...EMPTY, cycle: CYCLE, monthlyExpenses: [rent], txs: [posted] }).delta,
    ).toBe(0);
  });

  it('dépense ponctuelle : comptée seulement si elle tombe dans le cycle', () => {
    const forecast = computeForecast({
      ...EMPTY,
      cycle: CYCLE,
      spendings: [
        { ...re('in', 50), type: 'spending', dayOfMonth: null, date: '2026-11-20' },
        { ...re('out', 80), type: 'spending', dayOfMonth: null, date: '2026-11-30' },
      ],
    });

    expect(forecast.delta).toBe(-50);
  });
});
