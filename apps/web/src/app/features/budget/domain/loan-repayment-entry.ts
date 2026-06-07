import { Loan } from './models/loan.model';
import { RecurringEntry } from './models/recurring-entry.model';

export type LoanRepaymentEvent = {
  amount: number;
  date: string;
  accountId: string | null;
  note: string | null;
};

// Repaying a debt you owe = money out (spending); being repaid on a loan you granted = money in (income).
export function buildLoanRepaymentEntry(
  loan: Loan,
  event: LoanRepaymentEvent,
  labels: { label: string; category: string },
): Omit<RecurringEntry, 'id'> {
  return {
    label: labels.label,
    amount: event.amount,
    type: loan.direction === 'lent' ? 'income' : 'spending',
    accountId: event.accountId,
    memberId: loan.memberId,
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
