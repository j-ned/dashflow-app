import { RecurringEntry } from '../domain/models/recurring-entry.model';

/**
 * Applique les défauts auto-pointage aux récurrences déchiffrées :
 * les entrées créées avant cette feature n'ont pas ces champs dans leur blob.
 */
export function withAutoPostDefaults(raw: RecurringEntry): RecurringEntry {
  return {
    ...raw,
    autoPost: raw.autoPost ?? false,
    autoPostSince: raw.autoPostSince ?? null,
  };
}
