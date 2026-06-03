export type TransactionDirection = 'income' | 'expense' | 'transfer';

export type AccountTransaction = {
  readonly id: string;
  readonly accountId: string;
  readonly amount: number;
  readonly direction: TransactionDirection;
  readonly toAccountId: string | null;
  readonly date: string;
  readonly category: string | null;
  readonly note: string | null;
  readonly memberId: string | null;
  readonly recurringEntryId: string | null;
};
