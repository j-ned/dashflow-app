import { Loan } from './models/loan.model';
import { LoanTransaction } from './models/loan-transaction.model';

export type HistoryEntry = { readonly tx: LoanTransaction; readonly balanceAfter: number };

export type LoanStatus = 'overdue' | 'dueSoon' | 'settled' | 'ongoing';

export type LoanVM = {
  readonly loan: Loan;
  readonly repaid: number;
  readonly pct: number;
  readonly entries: readonly HistoryEntry[];
  readonly status: LoanStatus;
};
