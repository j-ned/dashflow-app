// Centimes entiers pour éviter la dérive flottante (0.1 + 0.2 = 0.30000000000000004) qui se persiste dans les soldes E2EE recalculés côté client.
export function addMoney(...amounts: number[]): number {
  const cents = amounts.reduce((sum, amount) => sum + Math.round(amount * 100), 0);
  return cents / 100;
}
