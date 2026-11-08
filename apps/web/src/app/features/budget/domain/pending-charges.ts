import { RecurringEntry } from './models/recurring-entry.model';
import { AccountTransaction } from './models/account-transaction.model';
import { PendingCharge } from './pending-charge';
import { isRecurrencePosted } from './account-balance';
import { isAutoEntry } from './auto-post';
import { isPastEndDate, occurrenceDate, occurrenceDay } from './recurrence-occurrence';

export type PendingChargesInput = {
  readonly incomes: readonly RecurringEntry[];
  readonly monthlyExpenses: readonly RecurringEntry[];
  readonly recurringTransfers: readonly RecurringEntry[];
  readonly ignored: ReadonlySet<string>;
  readonly salaryDay: number;
  readonly currentDay: number;
  readonly currentMonth: string;
  readonly txs: readonly AccountTransaction[];
};

function previousMonthOf(month: string): string {
  const [y, m] = month.split('-').map(Number);
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`;
}

/**
 * Mois ('YYYY-MM') de l'échéance à confirmer, ou `null` si rien n'est échu.
 * - jour effectif (plafonné à la fin du mois) ≤ aujourd'hui → l'échéance du mois courant (même
 *   règle que le pointage automatique : jamais de date future) ;
 * - sinon, tant que le salaire du mois n'est pas tombé, une échéance de fin de mois (jour ≥ jour
 *   de salaire) est celle du mois PRÉCÉDENT : le salaire du 28 août se saisit encore le 3 septembre.
 */
function dueMonth(day: number, p: PendingChargesInput): string | null {
  if (occurrenceDay(p.currentMonth, day) <= p.currentDay) return p.currentMonth;
  if (p.currentDay < p.salaryDay && day >= p.salaryDay) return previousMonthOf(p.currentMonth);
  return null;
}

export function buildPendingCharges(p: PendingChargesInput): PendingCharge[] {
  const candidates = [...p.incomes, ...p.monthlyExpenses, ...p.recurringTransfers];
  const charges: PendingCharge[] = [];
  for (const e of candidates) {
    if (e.accountId == null || e.dayOfMonth == null || isAutoEntry(e) || p.ignored.has(e.id)) {
      continue;
    }
    const month = dueMonth(e.dayOfMonth, p);
    if (month === null || isRecurrencePosted(e.id, month, p.txs)) continue;
    const suggestedDate = occurrenceDate(month, e.dayOfMonth);
    if (isPastEndDate(e, suggestedDate)) continue;
    charges.push({
      entry: e,
      direction: e.type === 'income' ? 'income' : e.type === 'transfer' ? 'transfer' : 'expense',
      suggestedDate,
      suggestedAmount: e.type === 'income' && e.variableAmount ? null : Number(e.amount),
    });
  }
  return charges;
}
