import { addMoney } from './money';
import { RecurringEntry } from './models/recurring-entry.model';
import { AccountTransaction } from './models/account-transaction.model';

/** Cycle de salaire, bornes incluses (YYYY-MM-DD) : de la dernière paie à la veille de la suivante. */
export type CycleWindow = { readonly start: string; readonly end: string };

const pad = (n: number): string => String(n).padStart(2, '0');

const daysInMonth = (year: number, month: number): number =>
  new Date(Date.UTC(year, month, 0)).getUTCDate();

/** Le jour `day` du mois, ramené au dernier jour quand le mois est plus court (paie du 31 en avril). */
function dateInMonth(year: number, month: number, day: number): string {
  return `${year}-${pad(month)}-${pad(Math.min(day, daysInMonth(year, month)))}`;
}

function shiftMonth(year: number, month: number, delta: number): [number, number] {
  const index = year * 12 + (month - 1) + delta;
  return [Math.floor(index / 12), (index % 12) + 1];
}

function dayBefore(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number) as [number, number, number];
  const date = new Date(Date.UTC(y, m - 1, d - 1));
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}

/**
 * Le cycle de salaire qui contient `today`. Une paie le 30 finance le mois suivant : le 8 novembre,
 * le cycle va du 30 octobre au 29 novembre. Salaire le 1er : c'est exactement le mois civil.
 */
export function salaryCycleWindow(today: string, salaryDay: number): CycleWindow {
  const [y, m] = today.split('-').map(Number) as [number, number];
  const payThisMonth = dateInMonth(y, m, salaryDay);
  const startMonth = today >= payThisMonth ? [y, m] : shiftMonth(y, m, -1);
  const [sy, sm] = startMonth as [number, number];
  const [ny, nm] = shiftMonth(sy, sm, 1);
  return {
    start: dateInMonth(sy, sm, salaryDay),
    end: dayBefore(dateInMonth(ny, nm, salaryDay)),
  };
}

/**
 * Date de l'échéance de `entry` dans le cycle, ou `null` s'il n'en a pas.
 * - récurrence (jour du mois) : l'échéance qui tombe entre les bornes ;
 * - opération datée : sa date, si elle tombe entre les bornes ;
 * - ni jour ni date : rattachée au cycle en cours (début du cycle).
 */
export function occurrenceIn(entry: RecurringEntry, cycle: CycleWindow): string | null {
  if (entry.dayOfMonth != null) {
    const [sy, sm] = cycle.start.split('-').map(Number) as [number, number];
    // Un cycle couvre au plus deux mois civils : celui de son début et le suivant.
    for (const [y, m] of [[sy, sm], shiftMonth(sy, sm, 1)] as const) {
      const date = dateInMonth(y, m, entry.dayOfMonth);
      if (date >= cycle.start && date <= cycle.end) return date;
    }
    return null;
  }
  if (entry.date != null) {
    return entry.date >= cycle.start && entry.date <= cycle.end ? entry.date : null;
  }
  return cycle.start;
}

/**
 * L'échéance du cycle est-elle déjà matérialisée par une opération réelle ?
 * Récurrence : une opération de ce mois-là. Opération ponctuelle : n'importe quelle opération.
 */
export function isOccurrencePosted(
  entry: RecurringEntry,
  occurrence: string,
  txs: readonly AccountTransaction[],
): boolean {
  const month = occurrence.slice(0, 7);
  return txs.some(
    (t) =>
      t.recurringEntryId === entry.id && (entry.dayOfMonth == null || t.date.slice(0, 7) === month),
  );
}

export type CycleIncome = {
  /** Revenus du cycle : le réel quand il a été saisi, le prévu sinon — jamais un montant deviné. */
  readonly total: number;
  /** Un revenu à montant variable du cycle n'est pas encore saisi : `total` est partiel. */
  readonly incomplete: boolean;
};

/** Revenus rattachés au cycle (la paie qui l'ouvre, et ce qui tombe avant la suivante). */
export function cycleIncome(
  incomes: readonly RecurringEntry[],
  txs: readonly AccountTransaction[],
  cycle: CycleWindow,
): CycleIncome {
  let total = 0;
  let incomplete = false;
  for (const entry of incomes) {
    const occurrence = occurrenceIn(entry, cycle);
    if (occurrence === null) continue;
    const received = txs.filter(
      (t) => t.recurringEntryId === entry.id && t.date >= cycle.start && t.date <= cycle.end,
    );
    if (received.length > 0) {
      for (const t of received) total = addMoney(total, t.amount);
    } else if (entry.variableAmount) {
      incomplete = true;
    } else {
      total = addMoney(total, Number(entry.amount));
    }
  }
  return { total, incomplete };
}
