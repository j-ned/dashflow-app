import { RecurringEntry } from './models/recurring-entry.model';
import { AccountTransaction } from './models/account-transaction.model';
import { isRecurrencePosted } from './account-balance';

export type DuePostingDirection = 'income' | 'expense' | 'transfer';

export type DuePosting = {
  readonly entry: RecurringEntry;
  readonly month: string; // 'YYYY-MM'
  readonly direction: DuePostingDirection;
  readonly date: string; // 'YYYY-MM-DD'
  readonly amount: number;
};

export type DuePostingsContext = {
  readonly currentMonth: string; // 'YYYY-MM'
  readonly currentDay: number; // 1..31
};

const AUTO_POST_TYPES: ReadonlySet<RecurringEntry['type']> = new Set(['income', 'expense', 'transfer']);

const directionOf = (entry: RecurringEntry): DuePostingDirection =>
  entry.type === 'income' ? 'income' : entry.type === 'transfer' ? 'transfer' : 'expense';

/** Liste des mois 'YYYY-MM' de `from` à `to` inclus (from ≤ to). */
function monthsBetween(from: string, to: string): string[] {
  const months: string[] = [];
  let [y, m] = from.split('-').map(Number);
  const [ty, tm] = to.split('-').map(Number);
  while (y < ty || (y === ty && m <= tm)) {
    months.push(`${y}-${String(m).padStart(2, '0')}`);
    m += 1;
    if (m > 12) { m = 1; y += 1; }
  }
  return months;
}

/**
 * Transactions à créer pour matérialiser les échéances auto-pointées :
 * - filtre autoPost, compte/jour présents, type éligible ;
 * - itère [autoPostSince … mois courant] (autoPostSince null → mois courant seul) ;
 * - mois courant : échu ssi dayOfMonth ≤ currentDay (gate calendaire, évite les dates futures) ;
 * - mois passé : échu en entier ;
 * - saute tout mois déjà pointé (idempotent) ; respecte endDate.
 */
export function duePostings(
  entries: readonly RecurringEntry[],
  txs: readonly AccountTransaction[],
  ctx: DuePostingsContext,
): DuePosting[] {
  const result: DuePosting[] = [];
  for (const entry of entries) {
    if (!entry.autoPost) continue;
    if (entry.accountId == null || entry.dayOfMonth == null) continue;
    if (!AUTO_POST_TYPES.has(entry.type)) continue;

    const since = entry.autoPostSince ?? ctx.currentMonth;
    if (since > ctx.currentMonth) continue;
    const endMonth = entry.endDate ? entry.endDate.slice(0, 7) : null;

    for (const month of monthsBetween(since, ctx.currentMonth)) {
      if (endMonth && month > endMonth) break;
      if (isRecurrencePosted(entry.id, month, txs)) continue;
      const isCurrent = month === ctx.currentMonth;
      if (isCurrent && entry.dayOfMonth > ctx.currentDay) continue;
      result.push({
        entry,
        month,
        direction: directionOf(entry),
        date: `${month}-${String(entry.dayOfMonth).padStart(2, '0')}`,
        amount: Number(entry.amount),
      });
    }
  }
  return result;
}
