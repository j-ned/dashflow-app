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

// Delta des récurrences (formule de endOfMonthBalance sans le solde initial),
// chaque somme excluant les entrées déjà postées (réconciliées avec une transaction réelle).
// Récurrent (dayOfMonth défini) : réconcilié pour le mois courant seulement — l'échéance du mois
// suivant reste à projeter. Ponctuel (dayOfMonth null) : one-shot, réconcilié définitivement dès
// qu'une transaction le porte, quel que soit son mois (sinon un revenu ponctuel posté à un mois
// passé serait compté à la fois dans le confirmé et dans le projeté).
export function computeForecastDelta(p: ForecastDeltaInput): number {
  const unposted = (e: RecurringEntry): boolean =>
    e.dayOfMonth == null
      ? !p.txs.some((t) => t.recurringEntryId === e.id)
      : !isRecurrencePosted(e.id, p.currentMonth, p.txs);
  const inc = sumAmount(p.incomes.filter(unposted));
  const exp = sumAmount(p.monthlyExpenses.filter(unposted));
  const ann = sumAmount(p.annualExpenses.filter(unposted)) / 12;
  const spend = sumAmount(p.monthSpendings.filter(unposted));
  const inTransfers = sumAmount(p.incomingTransfers.filter(unposted)) + p.oneTimeIncoming;
  const outTransfers = sumAmount(p.outgoingTransfers.filter(unposted)) + p.oneTimeOutgoing;
  return inc + inTransfers - exp - ann - spend - outTransfers;
}
