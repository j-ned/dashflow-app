import { SalaryArchive, SpendingSnapshot } from './models/salary-archive.model';
import { RecurringEntry } from './models/recurring-entry.model';

export function availableYears(archives: readonly SalaryArchive[]): string[] {
  const years = new Set(archives.map((a) => a.month.slice(0, 4)));
  return [...years].sort((a, b) => b.localeCompare(a));
}

export function filterArchivesByYear(
  archives: readonly SalaryArchive[],
  year: string | null,
): SalaryArchive[] {
  return year ? archives.filter((a) => a.month.startsWith(year)) : [...archives];
}

export function importedSpendings(
  entries: readonly RecurringEntry[],
  opts: { readonly month: string | null; readonly accountId: string | null },
): SpendingSnapshot[] {
  const { month, accountId } = opts;
  if (!month) return [];
  return entries
    .filter((e) => {
      if (e.type !== 'spending') return false;
      if (accountId && e.accountId !== accountId) return false;
      if (!e.date) return false;
      return e.date.startsWith(month);
    })
    .map((e) => ({
      label: e.label,
      amount: Number(e.amount),
      date: e.date,
      category: e.category,
    }));
}

export function previousMonth(now: Date): string {
  const d = new Date(Date.UTC(now.getFullYear(), now.getMonth() - 1, 1));
  return d.toISOString().slice(0, 7);
}
