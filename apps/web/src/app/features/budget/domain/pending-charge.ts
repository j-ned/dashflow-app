import { RecurringEntry } from './models/recurring-entry.model';

export type PendingCharge = {
  readonly entry: RecurringEntry;
  readonly direction: 'income' | 'expense' | 'transfer';
  readonly suggestedDate: string;
  readonly suggestedAmount: number;
};
