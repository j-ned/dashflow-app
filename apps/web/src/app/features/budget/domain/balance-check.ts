import { addMoney } from './money';
import { AccountTransaction } from './models/account-transaction.model';

/** Au-delà, on propose de revérifier le solde avec la banque. */
export const BALANCE_CHECK_EVERY_DAYS = 31;

/**
 * Comment rattraper un écart entre le solde calculé et le solde réel de la banque :
 * - `none` : les deux concordent, rien à écrire ;
 * - `starting-balance` : le compte n'a encore aucune opération, l'écart EST le point de départ —
 *   on le porte sur le solde initial plutôt que d'inventer une opération ;
 * - `adjustment` : le compte vit déjà, on enregistre une opération d'ajustement datée et visible
 *   dans le relevé, pour que la correction laisse une trace au lieu de réécrire le passé.
 */
export type BalanceReconciliation =
  | { readonly kind: 'none' }
  | { readonly kind: 'starting-balance'; readonly initialBalance: number }
  | {
      readonly kind: 'adjustment';
      readonly gap: number;
      readonly transaction: Pick<AccountTransaction, 'amount' | 'direction' | 'date'>;
    };

/** Écart au centime : positif = la banque a plus que ce que l'appli croit. */
export function balanceGap(confirmedBalance: number, realBalance: number): number {
  return addMoney(realBalance, -confirmedBalance);
}

export function reconcileBalance(p: {
  readonly confirmedBalance: number;
  readonly realBalance: number;
  readonly initialBalance: number;
  readonly hasTransactions: boolean;
  readonly today: string;
}): BalanceReconciliation {
  const gap = balanceGap(p.confirmedBalance, p.realBalance);
  if (gap === 0) return { kind: 'none' };
  if (!p.hasTransactions) {
    return { kind: 'starting-balance', initialBalance: addMoney(p.initialBalance, gap) };
  }
  return {
    kind: 'adjustment',
    gap,
    transaction: {
      amount: Math.abs(gap),
      direction: gap > 0 ? 'income' : 'expense',
      date: p.today,
    },
  };
}

export function isBalanceCheckDue(checkedAt: number | null, now: number): boolean {
  return checkedAt === null || now - checkedAt > BALANCE_CHECK_EVERY_DAYS * 86_400_000;
}
