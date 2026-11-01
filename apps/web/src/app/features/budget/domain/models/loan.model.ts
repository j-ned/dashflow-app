export type LoanDirection = 'lent' | 'borrowed';

export type Loan = {
  readonly id: string;
  readonly memberId: string | null;
  readonly person: string;
  readonly direction: LoanDirection;
  readonly amount: number;
  readonly remaining: number;
  readonly description: string;
  readonly date: string;
  readonly dueDate: string | null;
  readonly dueDay: number | null;
};
