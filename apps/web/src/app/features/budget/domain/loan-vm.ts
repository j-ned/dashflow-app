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

const STATUS_RANK: Record<LoanStatus, number> = {
  overdue: 0,
  dueSoon: 1,
  ongoing: 2,
  settled: 3,
};

// Repayment history per loan, newest first; capital remaining before each operation.
// Zero-amount rows (legacy E2EE snapshots) excluded.
export function buildLoanHistories(
  loans: readonly Loan[],
  transactions: readonly LoanTransaction[],
): Map<string, HistoryEntry[]> {
  const byLoan = new Map<string, LoanTransaction[]>();
  for (const tx of transactions) {
    if (Number(tx.amount) === 0) continue;
    const list = byLoan.get(tx.loanId);
    if (list) list.push(tx);
    else byLoan.set(tx.loanId, [tx]);
  }
  const result = new Map<string, HistoryEntry[]>();
  for (const loan of loans) {
    const txs = (byLoan.get(loan.id) ?? []).slice().sort((a, b) => b.date.localeCompare(a.date));
    let remaining = Number(loan.remaining);
    const entries: HistoryEntry[] = txs.map((tx) => {
      const entry: HistoryEntry = { tx, balanceAfter: remaining };
      remaining += Number(tx.amount); // reverse chronologically: before this repayment, more was owed
      return entry;
    });
    result.set(loan.id, entries);
  }
  return result;
}

export function buildLoanVMs(
  loans: readonly Loan[],
  histories: ReadonlyMap<string, HistoryEntry[]>,
  opts: {
    direction: Loan['direction'];
    filterMemberId: string | null;
    today: string;
    dueSoonLimit: string;
  },
): LoanVM[] {
  const filtered = loans.filter(
    (l) =>
      l.direction === opts.direction &&
      (!opts.filterMemberId || l.memberId === opts.filterMemberId),
  );
  const vms = filtered.map<LoanVM>((loan) => {
    const repaid = loan.amount - loan.remaining;
    const pct = loan.amount > 0 ? (repaid / loan.amount) * 100 : 0;
    let status: LoanStatus;
    if (loan.remaining <= 0) status = 'settled';
    else if (loan.dueDate && loan.dueDate < opts.today) status = 'overdue';
    else if (loan.dueDate && loan.dueDate <= opts.dueSoonLimit) status = 'dueSoon';
    else status = 'ongoing';
    return { loan, repaid, pct, entries: histories.get(loan.id) ?? [], status };
  });
  return vms.sort((a, b) => {
    if (STATUS_RANK[a.status] !== STATUS_RANK[b.status])
      return STATUS_RANK[a.status] - STATUS_RANK[b.status];
    const ad = a.loan.dueDate ?? '9999-12-31';
    const bd = b.loan.dueDate ?? '9999-12-31';
    if (ad !== bd) return ad.localeCompare(bd);
    return b.loan.remaining - a.loan.remaining;
  });
}
