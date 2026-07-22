import type { bankAccounts } from '../../db/schema';

export type BankAccount = typeof bankAccounts.$inferSelect;

/** DTO de sortie explicite : découple le contrat HTTP du schéma Drizzle brut. */
export function toBankAccountResponse(row: BankAccount) {
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    initialBalance: row.initialBalance,
    color: row.color,
    dotColor: row.dotColor,
    encryptedData: row.encryptedData,
    createdAt: row.createdAt,
  };
}
