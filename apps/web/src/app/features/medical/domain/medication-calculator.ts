import { Medication, MedicationWithStock } from './models/medication.model';

export function computeMedicationStock(med: Medication): MedicationWithStock {
  const activeDaysPerWeek = 7 - med.skipDays.length;
  const weeklyRate = med.dailyRate * activeDaysPerWeek;

  const calendarDays = weeklyRate > 0
    ? Math.floor((med.quantity / weeklyRate) * 7)
    : Infinity;

  const startDate = new Date(med.startDate);
  const runOutDate = new Date(startDate);
  let remaining = med.quantity;

  if (med.dailyRate > 0 && activeDaysPerWeek > 0) {
    while (remaining > 0) {
      const dayOfWeek = runOutDate.getDay();
      if (!med.skipDays.includes(dayOfWeek)) {
        remaining -= med.dailyRate;
      }
      if (remaining > 0) {
        runOutDate.setDate(runOutDate.getDate() + 1);
      }
    }
  }

  const daysRemaining = calendarDays === Infinity ? 9999 : calendarDays;
  const takeDaysRemaining = med.dailyRate > 0
    ? Math.ceil(med.quantity / med.dailyRate)
    : 0;
  const restDaysRemaining = Math.max(0, daysRemaining - takeDaysRemaining);

  return {
    ...med,
    daysRemaining,
    takeDaysRemaining,
    restDaysRemaining,
    estimatedRunOut: runOutDate.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }),
    isLow: daysRemaining <= med.alertDaysBefore,
  };
}
