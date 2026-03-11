export type RecurringEntryType = 'income' | 'expense' | 'annual_expense' | 'spending';

export type RecurringEntry = {
  id: string;
  memberId: string | null;
  accountId: string | null;
  label: string;
  amount: number;
  type: RecurringEntryType;
  dayOfMonth: number | null;
  date: string | null;
  category: string | null;
  payslipKey: string | null;
};
