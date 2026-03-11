import { Medication, MedicationWithStock } from './models/medication.model';

export function computeMedicationStock(med: Medication): MedicationWithStock {
  const activeDaysPerWeek = 7 - med.skipDays.length;
  const weeklyRate = med.dailyRate * activeDaysPerWeek;

  // Calendar days until stock runs out
  const calendarDays = weeklyRate > 0
    ? Math.floor((med.quantity / weeklyRate) * 7)
    : Infinity;

  // Compute exact run-out date skipping inactive days
  const startDate = new Date(med.startDate);
  const runOutDate = new Date(startDate);
  let remaining = med.quantity;

  if (med.dailyRate > 0 && activeDaysPerWeek > 0) {
    while (remaining > 0) {
      const dayOfWeek = runOutDate.getDay(); // 0=dim, 6=sam
      if (!med.skipDays.includes(dayOfWeek)) {
        remaining -= med.dailyRate;
      }
      if (remaining > 0) {
        runOutDate.setDate(runOutDate.getDate() + 1);
      }
    }
  }

  const daysRemaining = calendarDays === Infinity ? 9999 : calendarDays;

  return {
    ...med,
    daysRemaining,
    estimatedRunOut: runOutDate.toISOString().slice(0, 10),
    isLow: daysRemaining <= med.alertDaysBefore,
  };
}
