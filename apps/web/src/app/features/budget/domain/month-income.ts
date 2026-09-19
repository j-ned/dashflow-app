import { addMoney } from './money';
import { RecurringEntry } from './models/recurring-entry.model';
import { AccountTransaction } from './models/account-transaction.model';

export type MonthIncome = {
  /** Revenus du mois : le réel quand il a été saisi, le montant prévu sinon — jamais un montant deviné. */
  readonly total: number;
  /** Au moins un revenu à montant variable n'a pas encore été saisi : `total` est donc partiel. */
  readonly incomplete: boolean;
};

/**
 * Revenus du mois `month` (YYYY-MM). Pour chaque revenu récurrent :
 * - une transaction le porte ce mois-ci → on prend ce qui a réellement été reçu ;
 * - sinon, montant fixe → le montant prévu ;
 * - sinon, montant variable → rien, et le total est marqué incomplet.
 */
export function monthIncome(
  incomes: readonly RecurringEntry[],
  txs: readonly AccountTransaction[],
  month: string,
): MonthIncome {
  let total = 0;
  let incomplete = false;
  for (const entry of incomes) {
    const received = txs.filter(
      (t) => t.recurringEntryId === entry.id && t.date.slice(0, 7) === month,
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
