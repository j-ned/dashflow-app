import { RecurringEntry } from '../domain/models/recurring-entry.model';

/**
 * Normalise une récurrence renvoyée par l'API avant validation/usage :
 * - `amount` : les colonnes `numeric` Postgres reviennent en **string** pour les comptes en clair
 *   (ex. compte démo, encryptionVersion=0) ; on coerce en nombre, le schéma Zod et le domaine
 *   attendent un `number`. Pour un compte chiffré, `amount` vient déjà du blob comme nombre.
 * - `autoPost` / `autoPostSince` : absents des entrées créées avant la feature auto-pointage.
 * - `variableAmount` : absent des entrées créées avant les revenus à montant variable.
 */
export function normalizeRecurringEntry(raw: RecurringEntry): RecurringEntry {
  return {
    ...raw,
    amount: Number(raw.amount),
    autoPost: raw.autoPost ?? false,
    autoPostSince: raw.autoPostSince ?? null,
    variableAmount: raw.variableAmount ?? false,
  };
}
