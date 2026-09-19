import { describe, expect, it } from 'vitest';
import {
  BALANCE_CHECK_EVERY_DAYS,
  balanceGap,
  isBalanceCheckDue,
  reconcileBalance,
} from './balance-check';

const base = {
  confirmedBalance: 1441.41,
  initialBalance: 0,
  hasTransactions: true,
  today: '2026-09-19',
};

describe('balanceGap', () => {
  it.each([
    [1441.41, 1441.41, 0],
    [1441.41, 1438.31, -3.1],
    [-608.99, 891.01, 1500],
    [0.1, 0.3, 0.2],
  ])('confirmé %s, banque %s → écart %s (au centime, sans bruit de flottant)', (c, r, gap) => {
    expect(balanceGap(c, r)).toBe(gap);
  });
});

describe('reconcileBalance', () => {
  it('soldes identiques : rien à écrire', () => {
    expect(reconcileBalance({ ...base, realBalance: 1441.41 })).toEqual({ kind: 'none' });
  });

  it('la banque a moins (Macif +3,10 €) : une dépense d’ajustement datée du jour', () => {
    expect(reconcileBalance({ ...base, realBalance: 1438.31 })).toEqual({
      kind: 'adjustment',
      gap: -3.1,
      transaction: { amount: 3.1, direction: 'expense', date: '2026-09-19' },
    });
  });

  it('la banque a plus (rentrée non saisie) : un revenu d’ajustement', () => {
    const outcome = reconcileBalance({ ...base, realBalance: 1500 });
    expect(outcome).toMatchObject({
      kind: 'adjustment',
      transaction: { amount: 58.59, direction: 'income' },
    });
  });

  it('compte sans aucune opération : l’écart devient le solde de départ, pas une opération', () => {
    const outcome = reconcileBalance({
      confirmedBalance: 0,
      initialBalance: 0,
      hasTransactions: false,
      realBalance: 2310.55,
      today: '2026-09-19',
    });
    expect(outcome).toEqual({ kind: 'starting-balance', initialBalance: 2310.55 });
  });

  it('compte sans opération mais avec un solde de départ déjà saisi : on le corrige', () => {
    const outcome = reconcileBalance({
      confirmedBalance: 500,
      initialBalance: 500,
      hasTransactions: false,
      realBalance: 480,
      today: '2026-09-19',
    });
    expect(outcome).toEqual({ kind: 'starting-balance', initialBalance: 480 });
  });
});

describe('isBalanceCheckDue', () => {
  const now = Date.UTC(2026, 8, 19);
  const daysAgo = (d: number) => now - d * 86_400_000;

  it.each([
    ['jamais vérifié', null, true],
    ['vérifié hier', daysAgo(1), false],
    ['vérifié à la limite', daysAgo(BALANCE_CHECK_EVERY_DAYS), false],
    ['vérifié il y a plus d’un mois', daysAgo(BALANCE_CHECK_EVERY_DAYS + 1), true],
  ])('%s', (_label, checkedAt, due) => {
    expect(isBalanceCheckDue(checkedAt, now)).toBe(due);
  });
});
