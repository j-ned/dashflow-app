import { Envelope } from './models/envelope.model';
import { RecurringEntry } from './models/recurring-entry.model';

export type EnvelopeCreditEvent = {
  amount: number;
  date: string;
  note: string | null;
  accountId: string | null;
};

export function buildEnvelopeCreditEntry(
  envelope: Envelope,
  event: EnvelopeCreditEvent,
  labels: { label: string; category: string },
): Omit<RecurringEntry, 'id'> {
  return {
    label: labels.label,
    amount: event.amount,
    type: 'spending',
    accountId: event.accountId,
    memberId: envelope.memberId,
    dayOfMonth: null,
    date: event.date || null,
    endDate: null,
    toAccountId: null,
    category: labels.category,
    payslipKey: null,
    autoPost: false,
    autoPostSince: null,
  };
}
