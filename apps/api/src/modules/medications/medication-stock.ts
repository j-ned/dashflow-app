/**
 * Modèle de stock unique, identique au front (`medication-calculator.ts`) :
 *  - `quantity` = stock au `startDate` (pas le stock courant) ;
 *  - consommation `dailyRate` par jour actif, les `skipDays` (0 = dimanche … 6 = samedi)
 *    ne consomment pas ;
 *  - la rupture se projette jour par jour depuis aujourd'hui avec le stock restant.
 * Avant : `alerts()` lisait `quantity` comme stock courant sans `startDate`, l'iCal comme stock
 * initial sans `skipDays` — deux dates de rupture différentes pour le même médicament.
 */
export type StockInput = {
  quantity: number;
  dailyRate: string | number;
  startDate: string;
  skipDays: unknown;
  alertDaysBefore: number;
};

export type StockProjection = {
  remainingQuantity: number;
  /** Jours calendaires avant rupture (0 si déjà à sec ou non calculable). */
  daysRemaining: number;
  /** Date de rupture `YYYY-MM-DD`, ou `null` si le stock ne s'épuise pas (rythme nul). */
  runOutDate: string | null;
  isLow: boolean;
};

import { today } from '../../common/today';

const MAX_PROJECTION_DAYS = 3650;

const isoDate = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

function skipDaysOf(raw: unknown): number[] {
  return Array.isArray(raw)
    ? raw.filter((d): d is number => Number.isInteger(d) && d >= 0 && d <= 6)
    : [];
}

function countActiveDays(from: Date, to: Date, skipDays: number[]): number {
  let count = 0;
  const cursor = new Date(from);
  while (cursor < to) {
    if (!skipDays.includes(cursor.getDay())) count++;
    cursor.setDate(cursor.getDate() + 1);
  }
  return count;
}

export function computeMedicationStock(
  med: StockInput,
  now = new Date(),
): StockProjection {
  // Jour civil au fuseau des utilisateurs (le serveur tourne en UTC), cf. common/today.
  const [ty, tm, td] = today(now).split('-').map(Number);
  const today0 = new Date(ty, tm - 1, td);
  return projectStock(med, today0);
}

function projectStock(med: StockInput, today: Date): StockProjection {
  const dailyRate = Number(med.dailyRate);
  const skipDays = skipDaysOf(med.skipDays);
  const activeDaysPerWeek = 7 - skipDays.length;
  const [y, m, d] = med.startDate.split('-').map(Number);
  const startDate = new Date(y, (m ?? 1) - 1, d ?? 1);

  const activeDaysSinceStart =
    startDate < today ? countActiveDays(startDate, today, skipDays) : 0;
  const consumed = Math.min(med.quantity, activeDaysSinceStart * dailyRate);
  const remainingQuantity = Math.max(0, med.quantity - consumed);

  if (!(dailyRate > 0) || activeDaysPerWeek <= 0) {
    return {
      remainingQuantity,
      daysRemaining: 0,
      runOutDate: null,
      isLow: false,
    };
  }
  if (remainingQuantity <= 0) {
    return {
      remainingQuantity: 0,
      daysRemaining: 0,
      runOutDate: isoDate(today),
      isLow: true,
    };
  }

  // La consommation démarre au plus tôt au startDate : un traitement qui commence dans un mois
  // ne peut pas être « à sec dans 3 jours ».
  const cursor = new Date(startDate > today ? startDate : today);
  let daysRemaining = Math.round(
    (cursor.getTime() - today.getTime()) / 86_400_000,
  );
  let stock = remainingQuantity;
  let projected = 0;
  while (stock > 0 && projected < MAX_PROJECTION_DAYS) {
    if (!skipDays.includes(cursor.getDay())) stock -= dailyRate;
    projected++;
    if (stock > 0) cursor.setDate(cursor.getDate() + 1);
  }
  daysRemaining += projected;
  return {
    remainingQuantity,
    daysRemaining,
    runOutDate: isoDate(cursor),
    isLow: daysRemaining <= med.alertDaysBefore,
  };
}
