import { RecurringEntry } from './models/recurring-entry.model';
import { normalizeCategory } from './categories';

export function isEntryActive(e: RecurringEntry, currentMonth: string): boolean {
  return !e.endDate || e.endDate.slice(0, 7) >= currentMonth;
}

export function isSpendingInMonth(e: RecurringEntry, currentMonth: string): boolean {
  return !e.date || e.date.startsWith(currentMonth);
}

export type MonthlyBreakdown = {
  readonly income: number;
  readonly expenses: number;
  readonly annualMonthly: number;
  readonly spendings: number;
  readonly envelopeCredits: number;
  readonly loanPayments: number;
  readonly totalCharges: number;
  readonly net: number;
};

export function monthlyBreakdown(
  entries: readonly RecurringEntry[],
  currentMonth: string,
): MonthlyBreakdown {
  const sum = (xs: readonly RecurringEntry[]) => xs.reduce((s, e) => s + Number(e.amount), 0);

  const income = sum(entries.filter((e) => e.type === 'income' && isEntryActive(e, currentMonth)));
  const expenses = sum(
    entries.filter((e) => e.type === 'expense' && isEntryActive(e, currentMonth)),
  );
  const annualMonthly =
    sum(entries.filter((e) => e.type === 'annual_expense' && isEntryActive(e, currentMonth))) / 12;

  const monthSpendings = entries.filter(
    (e) => e.type === 'spending' && isSpendingInMonth(e, currentMonth),
  );
  const spendings = sum(monthSpendings);
  const envelopeCredits = sum(
    monthSpendings.filter((e) => normalizeCategory(e.category).key === 'envelope'),
  );
  const loanPayments = sum(
    monthSpendings.filter((e) => normalizeCategory(e.category).key === 'repayment'),
  );

  const totalCharges = expenses + annualMonthly + spendings;
  return {
    income,
    expenses,
    annualMonthly,
    spendings,
    envelopeCredits,
    loanPayments,
    totalCharges,
    net: income - totalCharges,
  };
}
