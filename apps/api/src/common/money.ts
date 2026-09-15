import { z } from 'zod';

/**
 * Arithmétique et validation monétaires.
 *
 * Les montants sont stockés en `numeric(12,2)`. Côté serveur on ne fait JAMAIS d'arithmétique
 * en flottant sur un montant : tout passe par des centimes entiers (`toCents`), et toute valeur
 * reçue du client passe par `money*` (Zod) qui refuse `NaN`, `Infinity`, les chaînes non
 * numériques, plus de 2 décimales et les dépassements de `numeric(12,2)`. Sans cela Postgres
 * accepte littéralement `'NaN'` dans une colonne numeric et un solde devient irrécupérable.
 */

/** Borne de `numeric(12,2)` : 10 chiffres entiers, 2 décimales. */
export const MONEY_MAX_CENTS = 999_999_999_999; // 9 999 999 999,99

const MONEY_PATTERN = /^-?\d{1,10}(\.\d{1,2})?$/;

/** Convertit une valeur validée en centimes entiers, sans passer par un flottant. */
export function toCents(value: string | number): number {
  const text = typeof value === 'number' ? value.toFixed(2) : value.trim();
  const match = /^(-?)(\d+)(?:\.(\d{1,2}))?$/.exec(text);
  if (!match) throw new RangeError(`Montant invalide : ${String(value)}`);
  const [, sign, units, decimals = ''] = match;
  const cents = Number(units) * 100 + Number(decimals.padEnd(2, '0'));
  return sign === '-' ? -cents : cents;
}

/** Représentation canonique `"-1234.50"` d'un nombre de centimes. */
export function fromCents(cents: number): string {
  const sign = cents < 0 ? '-' : '';
  const abs = Math.abs(cents);
  return `${sign}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, '0')}`;
}

/**
 * Somme sûre en centimes entiers : `0.1 + 0.2` donne bien `0.3`.
 * Les entrées doivent être des montants valides (≤ 2 décimales) : au-delà, le client a envoyé
 * une valeur que `money*` aurait refusée, on le signale plutôt que d'arrondir en silence.
 */
export function addMoney(...amounts: number[]): number {
  const cents = amounts.reduce((sum, amount) => sum + toCents(amount), 0);
  return cents / 100;
}

function isMoneyText(text: string): boolean {
  if (!MONEY_PATTERN.test(text)) return false;
  return Math.abs(toCents(text)) <= MONEY_MAX_CENTS;
}

/** Accepte `12.5`, `"12.50"`, `"-3"` ; refuse `NaN`, `Infinity`, `"abc"`, `1.005`, `1e21`. */
const moneyInput = z.union([z.number(), z.string()]).transform((v, ctx) => {
  const text = typeof v === 'number' ? String(v) : v.trim();
  if (typeof v === 'number' && !Number.isFinite(v)) {
    ctx.addIssue({ code: 'custom', message: 'Montant invalide' });
    return z.NEVER;
  }
  if (!isMoneyText(text)) {
    ctx.addIssue({
      code: 'custom',
      message: 'Montant invalide (nombre, 2 décimales max, ≤ 9 999 999 999,99)',
    });
    return z.NEVER;
  }
  return fromCents(toCents(text));
});

/** Montant signé, sortie canonique `string` (colonnes numeric). */
export const money = moneyInput;
/** Montant ≥ 0 en `string`. */
export const nonNegativeMoney = moneyInput.refine((v) => !v.startsWith('-'), {
  message: 'Le montant doit être positif ou nul',
});
/** Montant > 0 en `string`. */
export const positiveMoney = moneyInput.refine((v) => toCents(v) > 0, {
  message: 'Le montant doit être strictement positif',
});

/** Mêmes règles, sortie `number` (routes qui calculent : crédit d'enveloppe, paiement). */
export const moneyNumber = moneyInput.transform((v) => Number(v));
export const positiveMoneyNumber = positiveMoney.transform((v) => Number(v));

/** `numeric(5,2)` strictement positif (posologie journalière). */
export const smallPositiveRate = positiveMoney.refine(
  (v) => toCents(v) <= 99_999,
  { message: 'Valeur trop grande (max 999,99)' },
);
