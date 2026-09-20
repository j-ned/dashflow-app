/**
 * Recalage temporel du jeu de données démo.
 *
 * Les snapshots `demo_seed_*` sont figés à leur date de capture : sans recalage, tous les
 * rendez-vous finissent « passés », les archives de paie s'éloignent et le mois courant est vide.
 * À chaque réinitialisation, les dates restaurées sont décalées pour que la date de capture du
 * snapshot devienne « aujourd'hui » :
 * - budget (archives, échéances ponctuelles, mouvements) : en MOIS entiers, pour garder les jours
 *   du mois (salaire le 27, loyer le 5) ;
 * - médical (rendez-vous, ordonnances, traitements, documents) : en JOURS, par semaines entières,
 *   pour garder les jours de la semaine (pas de consultation un dimanche).
 */

const DAY_MS = 86_400_000;

const utc = (isoDate: string): number => Date.parse(`${isoDate}T00:00:00Z`);

export type DemoShift = {
  /** Décalage des dates médicales, multiple de 7. */
  readonly days: number;
  /** Décalage des dates budgétaires. */
  readonly months: number;
};

/** `reference` et `today` au format `YYYY-MM-DD`. Jamais négatif : un snapshot « du futur » n'est pas recalé. */
export function demoShift(reference: string, today: string): DemoShift {
  const elapsedDays = Math.floor((utc(today) - utc(reference)) / DAY_MS);
  const months =
    (Number(today.slice(0, 4)) - Number(reference.slice(0, 4))) * 12 +
    (Number(today.slice(5, 7)) - Number(reference.slice(5, 7)));
  return {
    days: Math.max(0, Math.floor(elapsedDays / 7) * 7),
    months: Math.max(0, months),
  };
}

/** Mois clos précédant `today`, au format `YYYY-MM`. */
export function previousMonth(today: string): string {
  const year = Number(today.slice(0, 4));
  const month = Number(today.slice(5, 7));
  return month === 1
    ? `${year - 1}-12`
    : `${year}-${String(month - 1).padStart(2, '0')}`;
}

/** Colonnes `date` d'une table, recalées dans UN seul UPDATE (les CHECK entre colonnes tiennent). */
export type DateColumns = {
  readonly table: string;
  readonly columns: readonly string[];
  /** Table sans `user_id` : scopée par son parent. */
  readonly parent?: { readonly table: string; readonly key: string };
};

/** Médical : décalage en jours. `birth_date` n'est volontairement pas recalée. */
export const DAY_SHIFTED: readonly DateColumns[] = [
  { table: 'appointments', columns: ['date'] },
  { table: 'prescriptions', columns: ['issued_date', 'valid_until'] },
  { table: 'medications', columns: ['start_date'] },
  { table: 'documents', columns: ['date'] },
];

/** Budget : décalage en mois. */
export const MONTH_SHIFTED: readonly DateColumns[] = [
  { table: 'account_transactions', columns: ['date'] },
  { table: 'recurring_entries', columns: ['date', 'end_date'] },
  { table: 'loans', columns: ['date', 'due_date'] },
  {
    table: 'envelope_transactions',
    columns: ['date'],
    parent: { table: 'envelopes', key: 'envelope_id' },
  },
  {
    table: 'loan_transactions',
    columns: ['date'],
    parent: { table: 'loans', key: 'loan_id' },
  },
];
