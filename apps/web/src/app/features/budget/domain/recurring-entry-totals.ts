import { RecurringEntry } from './models/recurring-entry.model';

export const sumAmount = (entries: readonly RecurringEntry[]): number =>
  entries.reduce((s, e) => s + Number(e.amount), 0);
