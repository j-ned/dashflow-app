import { Envelope } from './models/envelope.model';
import { Loan } from './models/loan.model';
import { addMoney } from './money';

/** True uniquement quand un crédit positif fait passer l'enveloppe de sous l'objectif à l'objectif atteint. */
export function envelopeGoalJustReached(before: Envelope, amount: number): boolean {
  if (before.target == null || amount <= 0) return false;
  const wasReached = before.balance >= before.target;
  const nowReached = addMoney(before.balance, amount) >= before.target;
  return !wasReached && nowReached;
}

/** True uniquement quand un remboursement positif fait passer le prêt/dette de dû à entièrement soldé. */
export function loanJustSettled(before: Loan, amount: number): boolean {
  if (amount <= 0) return false;
  const wasSettled = before.remaining <= 0;
  const nowSettled = addMoney(before.remaining, -amount) <= 0;
  return !wasSettled && nowSettled;
}
