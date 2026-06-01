import { SalaryArchive } from './models/salary-archive.model';

// Reste d'un mois archivé = salaire − charges fixes − dépenses.
export function salaryArchiveRemaining(a: SalaryArchive): number {
  return Number(a.salary) - Number(a.totalExpenses) - Number(a.totalSpendings);
}
