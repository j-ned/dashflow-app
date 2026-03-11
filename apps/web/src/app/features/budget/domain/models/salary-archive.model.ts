export type SpendingSnapshot = {
  readonly label: string;
  readonly amount: number;
  readonly date: string | null;
  readonly category: string | null;
};

export type SalaryArchive = {
  readonly id: string;
  readonly accountId: string | null;
  readonly month: string;
  readonly salary: number;
  readonly totalExpenses: number;
  readonly totalSpendings: number;
  readonly spendings: SpendingSnapshot[];
  readonly payslipKey: string | null;
};
