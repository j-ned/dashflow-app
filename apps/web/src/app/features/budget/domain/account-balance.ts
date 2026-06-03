import { addMoney } from './money';
import { AccountTransaction } from './models/account-transaction.model';

/**
 * Solde confirmé d'un compte = solde initial + Σ revenus − Σ dépenses ± transferts,
 * sur les transactions dont la date est ≤ `asOf` (YYYY-MM-DD).
 * Le réel fait foi ; les récurrences ne projettent que le futur.
 */
export function confirmedBalance(
  account: { initialBalance: number; id?: string },
  txs: readonly AccountTransaction[],
  asOf: string,
): number {
  let balance = account.initialBalance;
  for (const t of txs) {
    if (t.date > asOf) continue;
    if (t.direction === 'income') balance = addMoney(balance, t.amount);
    else if (t.direction === 'expense') balance = addMoney(balance, -t.amount);
    else {
      if (account.id && t.toAccountId === account.id) balance = addMoney(balance, t.amount);
      else balance = addMoney(balance, -t.amount);
    }
  }
  return balance;
}

/** Une récurrence est « postée » pour le mois M (YYYY-MM) ssi une transaction porte son id ce mois-là. */
export function isRecurrencePosted(
  recurringEntryId: string,
  month: string,
  txs: readonly AccountTransaction[],
): boolean {
  return txs.some((t) => t.recurringEntryId === recurringEntryId && t.date.slice(0, 7) === month);
}
