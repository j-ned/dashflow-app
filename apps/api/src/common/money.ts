/**
 * Arithmétique monétaire sûre.
 *
 * Les montants sont stockés en `numeric(12,2)` mais manipulés en `number` JS (flottant).
 * Additionner des flottants accumule une dérive (`0.1 + 0.2 = 0.30000000000000004`),
 * problématique sur un solde mis à jour de façon incrémentale. On calcule donc en
 * **centimes entiers** puis on revient en unités.
 */
export function addMoney(...amounts: number[]): number {
  const cents = amounts.reduce((sum, amount) => sum + Math.round(amount * 100), 0);
  return cents / 100;
}
