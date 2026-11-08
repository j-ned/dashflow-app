import { RecurringEntry } from './models/recurring-entry.model';
import { AccountTransaction } from './models/account-transaction.model';
import { CycleWindow, isOccurrencePosted, occurrenceIn } from './salary-cycle-window';
import { sumAmount } from './recurring-entry-totals';

export type ForecastDeltaInput = {
  readonly incomes: readonly RecurringEntry[];
  readonly monthlyExpenses: readonly RecurringEntry[];
  readonly annualExpenses: readonly RecurringEntry[];
  /** Toutes les dépenses ponctuelles : seules celles datées dans le cycle comptent. */
  readonly spendings: readonly RecurringEntry[];
  readonly incomingTransfers: readonly RecurringEntry[];
  readonly outgoingTransfers: readonly RecurringEntry[];
  /** Virements ponctuels reçus / émis par le compte affiché. */
  readonly oneTimeIncoming: readonly RecurringEntry[];
  readonly oneTimeOutgoing: readonly RecurringEntry[];
  readonly txs: readonly AccountTransaction[];
  /** Cycle de salaire en cours : la projection s'arrête à la veille de la prochaine paie. */
  readonly cycle: CycleWindow;
};

export type Forecast = {
  /** Ce que les échéances non encore réconciliées ajoutent (ou retirent) d'ici la fin du cycle. */
  readonly delta: number;
  /** Part certaine de ce delta : tout ce qui reste à débiter (prélèvements, annuels, dépenses, virements). */
  readonly upcomingDebits: number;
  /**
   * Revenus du cycle à montant variable pas encore saisis. Tant qu'il y en a, `delta` les ignore
   * et la projection est INCOMPLÈTE : on ne devine pas un salaire, on le dit.
   */
  readonly unknownIncomes: readonly RecurringEntry[];
};

/** Échéances du cycle pas encore matérialisées par une opération réelle. */
function unpostedIn(p: ForecastDeltaInput): (e: RecurringEntry) => boolean {
  return (e) => {
    const occurrence = occurrenceIn(e, p.cycle);
    return occurrence !== null && !isOccurrencePosted(e, occurrence, p.txs);
  };
}

// Charge annuelle : provisionnée au 1/12 sur chaque cycle, sauf si elle a été payée pendant celui-ci.
function annualUnpaidIn(p: ForecastDeltaInput): (e: RecurringEntry) => boolean {
  return (e) =>
    !p.txs.some(
      (t) => t.recurringEntryId === e.id && t.date >= p.cycle.start && t.date <= p.cycle.end,
    );
}

/**
 * Projection à la veille de la prochaine paie. Trois états de l'argent, jamais mélangés :
 * - réel : déjà dans le solde confirmé, donc absent d'ici ;
 * - attendu : échéance du cycle à montant connu, pas encore réconciliée → comptée ;
 * - inconnu : revenu du cycle à montant variable pas encore saisi → exclu et signalé.
 * La paie suivante ouvre le cycle suivant : elle n'est jamais attendue ici.
 */
export function computeForecast(p: ForecastDeltaInput): Forecast {
  const unposted = unpostedIn(p);
  const pendingIncomes = p.incomes.filter(unposted);
  const unknownIncomes = pendingIncomes.filter((e) => e.variableAmount);

  const inc = sumAmount(pendingIncomes.filter((e) => !e.variableAmount));
  const exp = sumAmount(p.monthlyExpenses.filter(unposted));
  const ann = sumAmount(p.annualExpenses.filter(annualUnpaidIn(p))) / 12;
  const spend = sumAmount(p.spendings.filter(unposted));
  const inTransfers =
    sumAmount(p.incomingTransfers.filter(unposted)) + sumAmount(p.oneTimeIncoming.filter(unposted));
  const outTransfers =
    sumAmount(p.outgoingTransfers.filter(unposted)) + sumAmount(p.oneTimeOutgoing.filter(unposted));

  const upcomingDebits = exp + ann + spend + outTransfers;
  return { delta: inc + inTransfers - upcomingDebits, upcomingDebits, unknownIncomes };
}

/** Delta seul, pour les appelants qui n'ont pas besoin de savoir si la projection est complète. */
export function computeForecastDelta(p: ForecastDeltaInput): number {
  return computeForecast(p).delta;
}
