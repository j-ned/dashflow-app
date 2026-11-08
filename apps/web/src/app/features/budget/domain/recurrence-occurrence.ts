import { RecurringEntry } from './models/recurring-entry.model';

const pad = (n: number): string => String(n).padStart(2, '0');

/** Nombre de jours du mois 'YYYY-MM'. */
export function lastDayOfMonth(month: string): number {
  const [y, m] = month.split('-').map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

/**
 * Jour effectif d'une échéance mensuelle dans `month` : un « 31 » tombe le dernier jour des mois
 * plus courts, comme le font les banques. Sans ce plafond on produirait « 2026-02-31 », que la base
 * refuse en clair et que l'affichage fait glisser au mois suivant une fois chiffré.
 */
export function occurrenceDay(month: string, dayOfMonth: number): number {
  return Math.min(dayOfMonth, lastDayOfMonth(month));
}

/** Date 'YYYY-MM-DD' de l'échéance mensuelle dans `month`. */
export function occurrenceDate(month: string, dayOfMonth: number): string {
  return `${month}-${pad(occurrenceDay(month, dayOfMonth))}`;
}

/** Vrai si l'échéance du `date` tombe après la date de fin (comparée au jour, pas au mois). */
export function isPastEndDate(entry: Pick<RecurringEntry, 'endDate'>, date: string): boolean {
  return entry.endDate != null && date > entry.endDate;
}

/**
 * Un virement sans destinataire (compte supprimé : la FK passe à null) sortirait l'argent du compte
 * source sans le créditer nulle part : on ne le matérialise pas tant qu'il n'est pas réassigné.
 */
export function lacksTransferTarget(entry: Pick<RecurringEntry, 'type' | 'toAccountId'>): boolean {
  return entry.type === 'transfer' && entry.toAccountId == null;
}
