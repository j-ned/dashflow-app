import { describe, expect, it } from 'vitest';
import {
  balanceHistorySeries,
  incomeVsExpensesSeries,
  expenseCategoryBreakdown,
  envelopeForecastSeries,
} from './analytics-charts';
import { SalaryArchive } from './models/salary-archive.model';
import { RecurringEntry } from './models/recurring-entry.model';
import { Envelope } from './models/envelope.model';

const arch = (p: Partial<SalaryArchive>): SalaryArchive => ({
  id: 'a',
  accountId: null,
  month: '2026-01',
  salary: 2000,
  totalExpenses: 800,
  totalSpendings: 150,
  spendings: [],
  payslipKey: null,
  ...p,
});
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
const env = (p: Partial<Envelope>): Envelope => ({
  id: 'e',
  memberId: null,
  name: 'Env',
  type: 'épargne',
  balance: 0,
  target: null,
  color: '#000',
  dueDay: null,
  ...p,
});

describe('balanceHistorySeries', () => {
  it('12 derniers, valeur = remaining', () => {
    expect(
      balanceHistorySeries([
        arch({ month: '2026-01', salary: 2000, totalExpenses: 800, totalSpendings: 150 }),
      ]),
    ).toEqual([{ month: '2026-01', value: 1050 }]);
  });
});

describe('incomeVsExpensesSeries', () => {
  it('6 derniers, charges = totalExpenses + totalSpendings', () => {
    expect(
      incomeVsExpensesSeries([
        arch({ month: '2026-01', salary: 2000, totalExpenses: 800, totalSpendings: 150 }),
      ]),
    ).toEqual([{ month: '2026-01', salary: 2000, charges: 950 }]);
  });
});

describe('expenseCategoryBreakdown', () => {
  it('expense + annual/12, filtré isActive, regroupé par catégorie', () => {
    const out = expenseCategoryBreakdown(
      [
        e({ type: 'expense', amount: 300, category: 'Logement' }),
        e({ type: 'annual_expense', amount: 1200, category: 'Assurance' }),
        e({ type: 'expense', amount: 999, category: 'Logement', endDate: '2026-05-31' }),
        e({ type: 'spending', amount: 50, category: 'Logement' }),
      ],
      '2026-06',
    );
    expect(out.find((d) => d.i18nKey === 'budget.analytics.category.housing')?.value).toBe(300);
    expect(out.find((d) => d.i18nKey === 'budget.analytics.category.insurance')?.value).toBe(100);
    expect(out.length).toBe(2);
  });
});

describe('envelopeForecastSeries', () => {
  it('today + 6 mois, capé à la cible', () => {
    const series = envelopeForecastSeries([env({ balance: 100, target: 400 })], 50, {
      now: new Date(2026, 5, 1),
    });
    expect(series[0]).toEqual({ monthOffset: 0, value: 100 });
    expect(series.length).toBe(7);
    expect(series[6].value).toBe(400);
  });
  it('vide si aucune enveloppe avec cible', () => {
    expect(
      envelopeForecastSeries([env({ target: null })], 0, { now: new Date(2026, 5, 1) }),
    ).toEqual([]);
  });
});
