import { describe, expect, it } from 'vitest';
import { RecurringEntry, RecurringEntryType } from './models/recurring-entry.model';
import { AccountTransaction } from './models/account-transaction.model';
import { computeForecast } from './forecast-delta';
import { monthIncome } from './month-income';
import { buildPendingCharges } from './pending-charges';
import { isIncomeCharge } from './pending-charge';

const MONTH = '2026-09';

function entry(
  id: string,
  type: RecurringEntryType,
  amount: number,
  over: Partial<RecurringEntry> = {},
): RecurringEntry {
  return {
    id,
    memberId: null,
    accountId: 'acc',
    toAccountId: null,
    label: id,
    amount,
    type,
    dayOfMonth: 1,
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

function received(
  recurringEntryId: string,
  amount: number,
  date = `${MONTH}-01`,
): AccountTransaction {
  return {
    id: `tx-${recurringEntryId}`,
    accountId: 'acc',
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

const salary = entry('salaire', 'income', 1921.33, { variableAmount: true });
const pension = entry('pension', 'income', 300);
const rent = entry('loyer', 'expense', 600);
const phone = entry('bouygues', 'expense', 8.99, { dayOfMonth: 19 });

const forecastInput = (incomes: RecurringEntry[], txs: AccountTransaction[] = []) => ({
  incomes,
  monthlyExpenses: [rent, phone],
  annualExpenses: [entry('taxe', 'annual_expense', 96)],
  monthSpendings: [],
  incomingTransfers: [],
  outgoingTransfers: [],
  oneTimeIncoming: 0,
  oneTimeOutgoing: 0,
  txs,
  currentMonth: MONTH,
});

describe('revenu à montant variable', () => {
  describe('computeForecast', () => {
    it('salaire non saisi : exclu du delta, signalé, et les prélèvements à venir restent chiffrés', () => {
      const f = computeForecast(forecastInput([salary]));
      expect(f.unknownIncomes.map((e) => e.id)).toEqual(['salaire']);
      expect(f.upcomingDebits).toBeCloseTo(600 + 8.99 + 96 / 12, 2);
      // Le modèle à 1 921,33 € ne compte pas : seul ce qui est sûr entre dans le delta.
      expect(f.delta).toBeCloseTo(-(600 + 8.99 + 8), 2);
    });

    it('salaire saisi ce mois-ci : la projection redevient complète', () => {
      const f = computeForecast(forecastInput([salary], [received('salaire', 2050)]));
      expect(f.unknownIncomes).toEqual([]);
    });

    it('salaire saisi le mois DERNIER : celui de ce mois reste inconnu', () => {
      const f = computeForecast(forecastInput([salary], [received('salaire', 2050, '2026-08-01')]));
      expect(f.unknownIncomes.map((e) => e.id)).toEqual(['salaire']);
    });

    it('revenu à montant fixe non reçu : compté comme attendu, projection complète', () => {
      const f = computeForecast(forecastInput([pension]));
      expect(f.unknownIncomes).toEqual([]);
      expect(f.delta).toBeCloseTo(300 - (600 + 8.99 + 8), 2);
    });
  });

  describe('monthIncome', () => {
    it.each([
      ['rien de saisi', [] as AccountTransaction[], 300, true],
      ['salaire saisi', [received('salaire', 2050)], 2350, false],
      [
        'les deux saisis, pension moindre que prévu',
        [received('salaire', 2050), received('pension', 280)],
        2330,
        false,
      ],
    ])('%s', (_label, txs, total, incomplete) => {
      expect(monthIncome([salary, pension], txs, MONTH)).toEqual({ total, incomplete });
    });

    it('ignore ce qui a été reçu un autre mois', () => {
      const result = monthIncome([salary], [received('salaire', 2050, '2026-08-01')], MONTH);
      expect(result).toEqual({ total: 0, incomplete: true });
    });
  });

  describe('buildPendingCharges', () => {
    const pending = (incomes: RecurringEntry[]) =>
      buildPendingCharges({
        incomes,
        monthlyExpenses: [rent],
        recurringTransfers: [],
        ignored: new Set(),
        salaryDay: 1,
        currentDay: 19,
        currentMonth: MONTH,
        txs: [],
      });

    it('salaire variable : proposé sans montant ; revenu fixe et prélèvement : préremplis', () => {
      const charges = pending([salary, pension]);
      const byId = Object.fromEntries(charges.map((c) => [c.entry.id, c]));
      expect(byId['salaire'].suggestedAmount).toBeNull();
      expect(byId['pension'].suggestedAmount).toBe(300);
      expect(byId['loyer'].suggestedAmount).toBe(600);
      expect(charges.filter(isIncomeCharge).map((c) => c.entry.id)).toEqual(['salaire', 'pension']);
    });
  });
});
