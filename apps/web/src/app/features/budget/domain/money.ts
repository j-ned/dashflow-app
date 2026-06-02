/**
 * Arithmétique monétaire sûre (centimes entiers).
 *
 * Les soldes E2EE sont recalculés côté client puis ré-chiffrés. Additionner des
 * flottants accumule une dérive (`0.1 + 0.2 = 0.30000000000000004`) qui se persiste
 * dans le solde. On calcule en centimes entiers pour l'éviter.
 */
export function addMoney(...amounts: number[]): number {
  const cents = amounts.reduce((sum, amount) => sum + Math.round(amount * 100), 0);
  return cents / 100;
}
