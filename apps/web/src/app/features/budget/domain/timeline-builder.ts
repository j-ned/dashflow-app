import { RecurringEntry, RecurringEntryType } from './models/recurring-entry.model';
import { isExpensePassed } from './salary-cycle';

export type TimelineEvent = {
  id: string;
  day: number;
  label: string;
  amount: number;
  sign: '+' | '-';
  type: RecurringEntryType;
  passed: boolean;
};

export type TimelineInput = {
  readonly incomes: readonly RecurringEntry[];
  readonly monthlyExpenses: readonly RecurringEntry[];
  readonly outgoingTransfers: readonly RecurringEntry[];
  readonly incomingTransfers: readonly RecurringEntry[];
  readonly salaryDay: number;
  readonly currentDay: number;
  readonly accountName: (id: string | null) => string | null;
  readonly fallbackLabel: string;
};

export function buildTimelineEvents(p: TimelineInput): TimelineEvent[] {
  const passed = (e: RecurringEntry) => isExpensePassed(e, p.salaryDay, p.currentDay);
  const events: TimelineEvent[] = [];

  for (const e of p.incomes) {
    if (e.dayOfMonth)
      events.push({
        id: e.id, day: e.dayOfMonth, label: e.label, amount: Number(e.amount),
        sign: '+', type: 'income', passed: passed(e),
      });
  }
  for (const e of p.monthlyExpenses) {
    events.push({
      id: e.id, day: e.dayOfMonth ?? 1, label: e.label, amount: Number(e.amount),
      sign: '-', type: 'expense', passed: passed(e),
    });
  }
  for (const e of p.outgoingTransfers) {
    events.push({
      id: e.id, day: e.dayOfMonth ?? 1,
      label: `→ ${p.accountName(e.toAccountId) ?? p.fallbackLabel} — ${e.label}`,
      amount: Number(e.amount), sign: '-', type: 'transfer', passed: passed(e),
    });
  }
  for (const e of p.incomingTransfers) {
    events.push({
      id: e.id + '-in', day: e.dayOfMonth ?? 1,
      label: `← ${p.accountName(e.accountId) ?? p.fallbackLabel} — ${e.label}`,
      amount: Number(e.amount), sign: '+', type: 'transfer', passed: passed(e),
    });
  }

  return events.sort((a, b) => {
    const orderA = a.day >= p.salaryDay ? a.day - p.salaryDay : a.day + 31 - p.salaryDay;
    const orderB = b.day >= p.salaryDay ? b.day - p.salaryDay : b.day + 31 - p.salaryDay;
    return orderA - orderB;
  });
}
