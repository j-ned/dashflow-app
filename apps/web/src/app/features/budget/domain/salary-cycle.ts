import { RecurringEntry } from './models/recurring-entry.model';

// Un prélèvement est "passé" dans le cycle salaire → salaire suivant.
// Ex: salaire le 25, aujourd'hui le 3 → passés = jours 25-31 + 1-3.
// Ex: salaire le 5, aujourd'hui le 20 → passés = jours 5-20.
export function isExpensePassed(
  entry: RecurringEntry,
  salaryDay: number,
  currentDay: number,
): boolean {
  const day = entry.dayOfMonth ?? 1;
  if (currentDay >= salaryDay) {
    return day >= salaryDay && day <= currentDay;
  }
  return day >= salaryDay || day <= currentDay;
}
