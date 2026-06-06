export type RecurringEntryType = 'income' | 'expense' | 'annual_expense' | 'spending' | 'transfer';

export type RecurringEntry = {
  id: string;
  memberId: string | null;
  accountId: string | null;
  toAccountId: string | null;
  label: string;
  amount: number;
  type: RecurringEntryType;
  dayOfMonth: number | null;
  date: string | null;
  endDate: string | null;
  category: string | null;
  payslipKey: string | null;
  autoPost: boolean;
  autoPostSince: string | null; // 'YYYY-MM' figé à l'activation de autoPost ; null si autoPost=false
};
