import { RecurringEntry, RecurringEntryType } from './models/recurring-entry.model';

export type RecurringEntryFormValue = {
  label: string;
  amount: number;
  dayOfMonth: number | null;
  date: string;
  endDate: string;
  toAccountId: string;
  category: string;
  memberId: string;
  autoPost: boolean;
};

export function buildRecurringEntryPayload(
  value: RecurringEntryFormValue,
  ctx: {
    type: RecurringEntryType;
    initial: RecurringEntry | null;
    forcedAccountId: string | null;
    currentMonth: string;
  },
): Omit<RecurringEntry, 'id'> {
  const autoPostSince = value.autoPost ? (ctx.initial?.autoPostSince ?? ctx.currentMonth) : null;
  return {
    label: value.label,
    amount: value.amount,
    type: ctx.type,
    dayOfMonth: value.dayOfMonth || null,
    date: value.date || null,
    endDate: value.endDate || null,
    toAccountId: ctx.type === 'transfer' ? value.toAccountId || null : null,
    category: value.category || null,
    memberId: value.memberId || null,
    accountId: ctx.initial?.accountId ?? ctx.forcedAccountId ?? null,
    payslipKey: ctx.initial?.payslipKey ?? null,
    autoPost: value.autoPost,
    autoPostSince,
  };
}
