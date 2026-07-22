import type { loans } from '../../db/schema';

export type Loan = typeof loans.$inferSelect;

/** DTO de sortie explicite : découple le contrat HTTP du schéma Drizzle brut. */
export function toLoanResponse(row: Loan) {
  return {
    id: row.id,
    memberId: row.memberId,
    person: row.person,
    direction: row.direction,
    amount: row.amount,
    remaining: row.remaining,
    description: row.description,
    date: row.date,
    dueDate: row.dueDate,
    dueDay: row.dueDay,
    encryptedData: row.encryptedData,
  };
}
