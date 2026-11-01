import { SalaryArchive } from './models/salary-archive.model';
import { RecurringEntry } from './models/recurring-entry.model';
import { Envelope } from './models/envelope.model';
import { salaryArchiveRemaining } from './salary-archive-remaining';
import { normalizeCategory } from './categories';
import { isEntryActive } from './analytics-monthly';

export function balanceHistorySeries(
  archives: readonly SalaryArchive[],
): { month: string; value: number }[] {
  return archives.slice(-12).map((a) => ({ month: a.month, value: salaryArchiveRemaining(a) }));
}

export function incomeVsExpensesSeries(
  archives: readonly SalaryArchive[],
): { month: string; salary: number; charges: number }[] {
  return archives.slice(-6).map((a) => ({
    month: a.month,
    salary: Number(a.salary),
    charges: Number(a.totalExpenses) + Number(a.totalSpendings),
  }));
}

export function expenseCategoryBreakdown(
  entries: readonly RecurringEntry[],
  currentMonth: string,
): { i18nKey: string; color: string; value: number }[] {
  const expenses = entries.filter(
    (e) => (e.type === 'expense' || e.type === 'annual_expense') && isEntryActive(e, currentMonth),
  );
  const byKey = new Map<string, { i18nKey: string; color: string; value: number }>();
  for (const e of expenses) {
    const category = normalizeCategory(e.category);
    const amount = e.type === 'annual_expense' ? Number(e.amount) / 12 : Number(e.amount);
    const acc = byKey.get(category.key);
    if (acc) acc.value += amount;
    else
      byKey.set(category.key, { i18nKey: category.i18nKey, color: category.color, value: amount });
  }
  return [...byKey.values()].sort((a, b) => b.value - a.value).slice(0, 8);
}

export function envelopeForecastSeries(
  envelopes: readonly Envelope[],
  monthlyEnvelopeCredits: number,
  _clock: { now: Date },
): { monthOffset: number; value: number }[] {
  const envs = envelopes.filter((e) => e.target && Number(e.target) > 0);
  if (envs.length === 0) return [];

  const totalBalance = envs.reduce((s, e) => s + Number(e.balance), 0);
  const totalTarget = envs.reduce((s, e) => s + Number(e.target ?? 0), 0);
  const monthlyContrib =
    monthlyEnvelopeCredits > 0 ? monthlyEnvelopeCredits : (totalTarget - totalBalance) / 12;

  const points: { monthOffset: number; value: number }[] = [
    { monthOffset: 0, value: totalBalance },
  ];
  for (let i = 1; i <= 6; i++) {
    points.push({
      monthOffset: i,
      value: Math.min(totalBalance + monthlyContrib * i, totalTarget),
    });
  }
  return points;
}
