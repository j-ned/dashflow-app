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
  const activeDaysSinceStart = startDate < today
    ? countActiveDays(startDate, today, med.skipDays)
    : 0;
  const consumedQuantity = Math.min(med.quantity, activeDaysSinceStart * med.dailyRate);
  const remainingQuantity = Math.max(0, med.quantity - consumedQuantity);

  // Project forward from today with remaining stock
  let daysRemaining = 0;
  let takeDaysRemaining = 0;
  const runOutDate = new Date(today);

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
    estimatedRunOut: runOutDate.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }),
    isLow: daysRemaining <= med.alertDaysBefore,
  };
}
