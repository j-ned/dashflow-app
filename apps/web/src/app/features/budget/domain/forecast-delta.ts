import { RecurringEntry } from './models/recurring-entry.model';
import { AccountTransaction } from './models/account-transaction.model';
import { isRecurrencePosted } from './account-balance';
import { sumAmount } from './recurring-entry-totals';

export type ForecastDeltaInput = {
  readonly incomes: readonly RecurringEntry[];
  readonly monthlyExpenses: readonly RecurringEntry[];
  readonly annualExpenses: readonly RecurringEntry[];
  readonly monthSpendings: readonly RecurringEntry[];
  readonly incomingTransfers: readonly RecurringEntry[];
  readonly outgoingTransfers: readonly RecurringEntry[];
  readonly oneTimeIncoming: number;
  readonly oneTimeOutgoing: number;
  readonly txs: readonly AccountTransaction[];
  readonly currentMonth: string;
};

export type Forecast = {
  /** Ce que les récurrences non encore réconciliées ajoutent (ou retirent) d'ici la fin du mois. */
  readonly delta: number;
  /** Part certaine de ce delta : tout ce qui reste à débiter (prélèvements, annuels, dépenses, virements). */
  readonly upcomingDebits: number;
  /**
   * Revenus à montant variable pas encore saisis ce mois-ci. Tant qu'il y en a, `delta` les ignore
   * et la projection est INCOMPLÈTE : on ne devine pas un salaire, on le dit.
   */
  readonly unknownIncomes: readonly RecurringEntry[];
};

// Récurrent (dayOfMonth défini) : réconcilié pour le mois courant seulement, l'échéance du mois
// suivant reste à projeter. Ponctuel (dayOfMonth null) : one-shot, réconcilié définitivement dès
// qu'une transaction le porte, quel que soit son mois (sinon un revenu ponctuel posté à un mois
// passé serait compté à la fois dans le confirmé et dans le projeté).
function unpostedIn(p: ForecastDeltaInput): (e: RecurringEntry) => boolean {
  return (e) =>
    e.dayOfMonth == null
      ? !p.txs.some((t) => t.recurringEntryId === e.id)
      : !isRecurrencePosted(e.id, p.currentMonth, p.txs);
}

/**
 * Projection de fin de mois. Trois états de l'argent, jamais mélangés :
 * - réel : déjà dans le solde confirmé, donc absent d'ici ;
 * - attendu : récurrence à montant connu, pas encore réconciliée → comptée ;
 * - inconnu : revenu à montant variable pas encore saisi → exclu et signalé.
 */
export function computeForecast(p: ForecastDeltaInput): Forecast {
  const unposted = unpostedIn(p);
  const pendingIncomes = p.incomes.filter(unposted);
  const unknownIncomes = pendingIncomes.filter((e) => e.variableAmount);

  const inc = sumAmount(pendingIncomes.filter((e) => !e.variableAmount));
  const exp = sumAmount(p.monthlyExpenses.filter(unposted));
  const ann = sumAmount(p.annualExpenses.filter(unposted)) / 12;
  const spend = sumAmount(p.monthSpendings.filter(unposted));
  const inTransfers = sumAmount(p.incomingTransfers.filter(unposted)) + p.oneTimeIncoming;
  const outTransfers = sumAmount(p.outgoingTransfers.filter(unposted)) + p.oneTimeOutgoing;

  const upcomingDebits = exp + ann + spend + outTransfers;
  return { delta: inc + inTransfers - upcomingDebits, upcomingDebits, unknownIncomes };
}

/** Delta seul, pour les appelants qui n'ont pas besoin de savoir si la projection est complète. */
export function computeForecastDelta(p: ForecastDeltaInput): number {
  return computeForecast(p).delta;
}
