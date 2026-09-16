import { Medication, MedicationWithStock } from './models/medication.model';

function countActiveDays(from: Date, to: Date, skipDays: number[]): number {
  let count = 0;
  const cursor = new Date(from);
  while (cursor < to) {
    if (!skipDays.includes(cursor.getDay())) count++;
    cursor.setDate(cursor.getDate() + 1);
  }
  return count;
}

export function computeMedicationStock(med: Medication, now = new Date()): MedicationWithStock {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startDate = new Date(med.startDate);
  const activeDaysPerWeek = 7 - med.skipDays.length;

  // Consumed since startDate (0 if start is in the future)
  const activeDaysSinceStart =
    startDate < today ? countActiveDays(startDate, today, med.skipDays) : 0;
  const consumedQuantity = Math.min(med.quantity, activeDaysSinceStart * med.dailyRate);
  const remainingQuantity = Math.max(0, med.quantity - consumedQuantity);

  // Projection depuis aujourd'hui, ou depuis le début du traitement s'il est à venir : un
  // traitement qui commence dans un mois ne peut pas être « à sec dans 3 jours ». Règle
  // identique côté serveur (medication-stock.ts).
  const runOutDate = new Date(startDate > today ? startDate : today);
  let daysRemaining = Math.round((runOutDate.getTime() - today.getTime()) / 86_400_000);
  let takeDaysRemaining = 0;

  if (med.dailyRate > 0 && activeDaysPerWeek > 0 && remainingQuantity > 0) {
    let stock = remainingQuantity;
    while (stock > 0) {
      const dayOfWeek = runOutDate.getDay();
      if (!med.skipDays.includes(dayOfWeek)) {
        stock -= med.dailyRate;
        takeDaysRemaining++;
      }
      daysRemaining++;
      if (stock > 0) {
        runOutDate.setDate(runOutDate.getDate() + 1);
      }
    }
  }

  const restDaysRemaining = Math.max(0, daysRemaining - takeDaysRemaining);

  return {
    ...med,
    consumedQuantity,
    remainingQuantity,
    daysRemaining,
    takeDaysRemaining,
    restDaysRemaining,
    estimatedRunOut: runOutDate.toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }),
    isLow: daysRemaining <= med.alertDaysBefore,
  };
}
