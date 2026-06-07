import { BankAccount } from './models/bank-account.model';
import { RecurringEntry, RecurringEntryType } from './models/recurring-entry.model';

export type Destination = 'third_party' | 'my_account';
export type TransferMode = 'recurring' | 'one_time';

export function destinationToggleVisible(type: RecurringEntryType | null | undefined): boolean {
  return type === 'expense' || type === 'transfer';
}

export function transferModeToggleVisible(type: RecurringEntryType | null | undefined): boolean {
  return type === 'transfer';
}

export function payslipZoneVisible(
  type: RecurringEntryType | null | undefined,
  hasInitial: boolean,
): boolean {
  return type === 'income' && hasInitial;
}

export function defaultDestination(type: RecurringEntryType | null | undefined): Destination {
  return (type ?? 'expense') === 'transfer' ? 'my_account' : 'third_party';
}

export function deriveActiveType(args: {
  baseType: RecurringEntryType | null | undefined;
  destination: Destination;
}): RecurringEntryType {
  if (destinationToggleVisible(args.baseType)) {
    return args.destination === 'my_account' ? 'transfer' : 'expense';
  }
  return args.baseType ?? 'expense';
}

export function defaultTransferMode(
  initial: RecurringEntry | null,
  fallback: TransferMode,
): TransferMode {
  if (initial?.type === 'transfer') {
    return initial.dayOfMonth != null ? 'recurring' : 'one_time';
  }
  return fallback;
}

export function targetAccountsFor(
  accounts: BankAccount[],
  sourceId: string | null | undefined,
): BankAccount[] {
  return accounts.filter((a) => a.id !== sourceId);
}
