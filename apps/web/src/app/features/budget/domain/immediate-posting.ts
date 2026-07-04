import { RecurringEntry } from './models/recurring-entry.model';
import { AUTO_POST_TYPES, directionOf, DuePosting } from './auto-post';

// Types matérialisables immédiatement à la création : le cycle d'auto-post mensuel
// (AUTO_POST_TYPES) + les dépenses variables (spending), qui sont des mouvements ponctuels
// déjà réalisés → doivent impacter le solde confirmé dès leur saisie. annual_expense reste
// exclu (montant lissé sur 12 mois, projection par nature, jamais matérialisé au réel).
const IMMEDIATE_POST_TYPES: ReadonlySet<RecurringEntry['type']> = new Set([
  ...AUTO_POST_TYPES,
  'spending',
]);

export function immediatePostingFor(
  entry: RecurringEntry,
  ctx: { today: string; currentMonth: string; currentDay: number },
): DuePosting | null {
  if (entry.accountId == null) return null;
  if (!IMMEDIATE_POST_TYPES.has(entry.type)) return null;

  let date: string;
  let month: string;

  if (entry.dayOfMonth == null) {
    // Ponctuel : dû ssi date renseignée et non future
    if (entry.date == null || entry.date > ctx.today) return null;
    date = entry.date;
    month = date.slice(0, 7);
  } else {
    // Récurrent : dû ssi dayOfMonth ≤ currentDay (borne inclusive)
    if (entry.dayOfMonth > ctx.currentDay) return null;
    month = ctx.currentMonth;
    date = `${month}-${String(entry.dayOfMonth).padStart(2, '0')}`;
  }

  if (entry.endDate != null && month > entry.endDate.slice(0, 7)) return null;

  return {
    entry,
    month,
    direction: directionOf(entry),
    date,
    amount: Number(entry.amount),
  };
}
