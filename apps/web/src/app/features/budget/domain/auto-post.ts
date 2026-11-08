import { RecurringEntry } from './models/recurring-entry.model';
import { AccountTransaction } from './models/account-transaction.model';
import { isRecurrencePosted } from './account-balance';
import {
  isPastEndDate,
  lacksTransferTarget,
  occurrenceDate,
  occurrenceDay,
} from './recurrence-occurrence';

type DuePostingDirection = 'income' | 'expense' | 'transfer';

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

/** Note technique portée par une opération que le pointage automatique a enregistrée. */
export const AUTO_POST_NOTE = 'auto';

export const AUTO_POST_TYPES: ReadonlySet<RecurringEntry['type']> = new Set([
  'income',
  'expense',
  'transfer',
]);

export const directionOf = (entry: RecurringEntry): DuePostingDirection =>
  entry.type === 'income' ? 'income' : entry.type === 'transfer' ? 'transfer' : 'expense';

/** Une entrée est auto-postée si son flag autoPost est vrai OU si c'est un virement
 *  (un virement récurrent s'exécute toujours automatiquement, jamais de confirmation manuelle). */
export const isAutoEntry = (entry: RecurringEntry): boolean =>
  entry.autoPost || entry.type === 'transfer';

/** Liste des mois 'YYYY-MM' de `from` à `to` inclus (from ≤ to). */
function monthsBetween(from: string, to: string): string[] {
  const months: string[] = [];
  let [y, m] = from.split('-').map(Number);
  const [ty, tm] = to.split('-').map(Number);
  while (y < ty || (y === ty && m <= tm)) {
    months.push(`${y}-${String(m).padStart(2, '0')}`);
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
  }
  return months;
}

/** Mois 'YYYY-MM' le plus récent où la récurrence a une opération, ou null. */
function lastPostedMonth(entryId: string, txs: readonly AccountTransaction[]): string | null {
  let last: string | null = null;
  for (const t of txs) {
    if (t.recurringEntryId !== entryId) continue;
    const month = t.date.slice(0, 7);
    if (last === null || month > last) last = month;
  }
  return last;
}

/**
 * Premier mois à pointer : le mois d'activation ; à défaut (virement créé avant ce champ), la
 * dernière occurrence postée, pour rattraper les mois où l'appli n'a pas été ouverte.
 */
function autoPostStart(
  entry: RecurringEntry,
  txs: readonly AccountTransaction[],
  currentMonth: string,
): string {
  return entry.autoPostSince ?? lastPostedMonth(entry.id, txs) ?? currentMonth;
}

/**
 * Transactions à créer pour matérialiser les échéances auto-pointées :
 * - filtre autoPost, compte/jour présents, type éligible, virement avec destinataire ;
 * - itère [mois de départ ... mois courant] (voir `autoPostStart`) ;
 * - jour plafonné au dernier jour du mois (un « 31 » tombe le 30 ou le 28) ;
 * - mois courant : échu ssi le jour effectif ≤ currentDay (gate calendaire, évite les dates futures) ;
 * - mois passé : échu en entier ;
 * - saute tout mois déjà pointé ou annulé par l'utilisateur (idempotent) ;
 * - s'arrête à la date de fin, comparée au jour.
 */
export function duePostings(
  entries: readonly RecurringEntry[],
  txs: readonly AccountTransaction[],
  ctx: DuePostingsContext,
): DuePosting[] {
  const result: DuePosting[] = [];
  for (const entry of entries) {
    if (!isAutoEntry(entry) || !AUTO_POST_TYPES.has(entry.type)) continue;
    if (entry.accountId == null || entry.dayOfMonth == null || lacksTransferTarget(entry)) continue;
    const day = entry.dayOfMonth;

    for (const month of monthsBetween(
      autoPostStart(entry, txs, ctx.currentMonth),
      ctx.currentMonth,
    )) {
      const date = occurrenceDate(month, day);
      if (isPastEndDate(entry, date)) break;
      if (entry.skippedMonths.includes(month) || isRecurrencePosted(entry.id, month, txs)) continue;
      if (month === ctx.currentMonth && occurrenceDay(month, day) > ctx.currentDay) continue;
      result.push({
        entry,
        month,
        direction: directionOf(entry),
        date,
        amount: Number(entry.amount),
      });
    }
  }
  return result;
}

/**
 * Prélèvements mensuels qu'on peut basculer en pointage automatique : montant fixe, rattachés à un
 * compte, avec un jour d'échéance, et pas déjà automatiques. Les revenus n'en font pas partie
 * (un revenu se constate, et s'il est à montant variable il ne se devine pas).
 */
export function autoPostCandidates(entries: readonly RecurringEntry[]): RecurringEntry[] {
  return entries.filter(
    (e) => e.type === 'expense' && !e.autoPost && e.accountId != null && e.dayOfMonth != null,
  );
}

/**
 * Active le pointage automatique à partir de `currentMonth` : les échéances de ce mois déjà échues
 * seront matérialisées au prochain passage de `duePostings`, jamais celles des mois précédents.
 */
export function withAutoPost(
  entry: RecurringEntry,
  currentMonth: string,
): Omit<RecurringEntry, 'id'> {
  const { id: _id, ...rest } = entry;
  return { ...rest, autoPost: true, autoPostSince: entry.autoPostSince ?? currentMonth };
}

/**
 * Récurrence à enregistrer quand l'utilisateur supprime une opération pointée automatiquement :
 * le mois est retenu pour que le pointage ne la recrée pas. `null` si rien à retenir (opération
 * étrangère à la récurrence, échéance à confirmer à la main, mois déjà retenu).
 */
export function skipDeletedOccurrence(
  tx: AccountTransaction,
  entry: RecurringEntry | undefined,
): Omit<RecurringEntry, 'id'> | null {
  if (entry === undefined || tx.recurringEntryId !== entry.id || !isAutoEntry(entry)) return null;
  const month = tx.date.slice(0, 7);
  if (entry.skippedMonths.includes(month)) return null;
  const { id: _id, ...rest } = entry;
  return { ...rest, skippedMonths: [...entry.skippedMonths, month].sort() };
}

/**
 * Récurrence à enregistrer quand l'utilisateur annule la suppression d'une opération : le mois
 * n'est plus retenu, l'opération rétablie redevient une occurrence ordinaire du pointage.
 * `null` si rien à oublier.
 */
export function unskipRestoredOccurrence(
  tx: AccountTransaction,
  entry: RecurringEntry | undefined,
): Omit<RecurringEntry, 'id'> | null {
  if (entry === undefined || tx.recurringEntryId !== entry.id) return null;
  const month = tx.date.slice(0, 7);
  if (!entry.skippedMonths.includes(month)) return null;
  const { id: _id, ...rest } = entry;
  return { ...rest, skippedMonths: entry.skippedMonths.filter((m) => m !== month) };
}

/**
 * Opérations en trop quand une même occurrence automatique a été postée plusieurs fois : deux
 * appareils (ou onglets) ouverts le même jour pointent chacun le mois. Le chiffrement empêche toute
 * contrainte d'unicité côté serveur (la date n'y est pas lisible), on répare donc à la lecture.
 * La survivante est la plus petite id : chaque appareil choisit la même, la réparation converge.
 */
export function duplicateAutoPostings(
  entries: readonly RecurringEntry[],
  txs: readonly AccountTransaction[],
): AccountTransaction[] {
  const autoIds = new Set(entries.filter(isAutoEntry).map((e) => e.id));
  const survivors = new Map<string, AccountTransaction>();
  const extras: AccountTransaction[] = [];
  for (const t of txs) {
    if (t.recurringEntryId === null || !autoIds.has(t.recurringEntryId)) continue;
    const key = `${t.recurringEntryId}|${t.date.slice(0, 7)}`;
    const kept = survivors.get(key);
    if (kept === undefined) survivors.set(key, t);
    else if (t.id < kept.id) {
      extras.push(kept);
      survivors.set(key, t);
    } else extras.push(t);
  }
  return extras;
}
