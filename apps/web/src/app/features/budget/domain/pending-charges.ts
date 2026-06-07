import { RecurringEntry } from './models/recurring-entry.model';
import { AccountTransaction } from './models/account-transaction.model';
import { PendingCharge } from './pending-charge';
import { isRecurrencePosted } from './account-balance';
import { isExpensePassed } from './salary-cycle';

export type PendingChargesInput = {
  readonly incomes: readonly RecurringEntry[];
  readonly monthlyExpenses: readonly RecurringEntry[];
  readonly recurringTransfers: readonly RecurringEntry[];
  readonly ignored: ReadonlySet<string>;
  readonly salaryDay: number;
  readonly currentDay: number;
  readonly currentMonth: string;
  readonly txs: readonly AccountTransaction[];
};

export function buildPendingCharges(p: PendingChargesInput): PendingCharge[] {
  const candidates = [...p.incomes, ...p.monthlyExpenses, ...p.recurringTransfers];
  return candidates
    .filter(
      (e) =>
        e.accountId != null &&
        e.dayOfMonth != null &&
        !e.autoPost &&
        isExpensePassed(e, p.salaryDay, p.currentDay) &&
        !isRecurrencePosted(e.id, p.currentMonth, p.txs) &&
        !p.ignored.has(e.id),
    )
    .map((e): PendingCharge => ({
      entry: e,
      direction:
        e.type === 'income' ? 'income' : e.type === 'transfer' ? 'transfer' : 'expense',
      suggestedDate: `${p.currentMonth}-${String(e.dayOfMonth).padStart(2, '0')}`,
      suggestedAmount: Number(e.amount),
    }));
}
