import { Envelope } from './models/envelope.model';
import { Loan } from './models/loan.model';

export type ForecastResult =
  | { readonly kind: 'surplus' | 'deficit'; readonly net: number }
  | {
      readonly kind: 'envelope';
      readonly name: string;
      readonly color: string;
      readonly balance: number;
      readonly target: number;
      readonly remaining: number;
      readonly contrib: number;
      readonly monthsToTarget: number | null;
    }
  | {
      readonly kind: 'loan';
      readonly direction: 'lent' | 'borrowed';
      readonly person: string;
      readonly color: string;
      readonly pct: number;
      readonly remaining: number;
      readonly payment: number;
      readonly monthsToClear: number | null;
    };

export function buildForecasts(input: {
  readonly net: number;
  readonly envelopes: readonly Envelope[];
  readonly loans: readonly Loan[];
  readonly envelopeCredits: number;
  readonly loanPayments: number;
}): ForecastResult[] {
  const { net, envelopes, loans, envelopeCredits, loanPayments } = input;
  const results: ForecastResult[] = [];

  if (net > 0) results.push({ kind: 'surplus', net });
  else if (net < 0) results.push({ kind: 'deficit', net });

  const envsWithTarget = envelopes.filter((e) => Number(e.target ?? 0) > 0);
  for (const env of envelopes) {
    const balance = Number(env.balance);
    const target = Number(env.target ?? 0);
    if (!target || target <= 0 || balance >= target) continue;
    const remaining = target - balance;
    const contrib = envelopeCredits > 0 ? envelopeCredits / Math.max(envsWithTarget.length, 1) : 0;
    results.push({
      kind: 'envelope',
      name: env.name,
      color: env.color || 'var(--color-ib-cyan)',
      balance,
      target,
      remaining,
      contrib,
      monthsToTarget: contrib > 0 ? Math.ceil(remaining / contrib) : null,
    });
  }

  const activeLoans = loans.filter((l) => Number(l.remaining) > 0);
  for (const loan of loans) {
    const amount = Number(loan.amount);
    const remaining = Number(loan.remaining);
    if (remaining <= 0) continue;
    const repaid = amount - remaining;
    const pct = amount > 0 ? (repaid / amount) * 100 : 0;
    const payment = loanPayments > 0 ? loanPayments / Math.max(activeLoans.length, 1) : 0;
    results.push({
      kind: 'loan',
      direction: loan.direction,
      person: loan.person,
      color: loan.direction === 'lent' ? 'var(--color-ib-blue)' : 'var(--color-ib-orange)',
      pct,
      remaining,
      payment,
      monthsToClear: payment > 0 ? Math.ceil(remaining / payment) : null,
    });
  }

  return results;
}
