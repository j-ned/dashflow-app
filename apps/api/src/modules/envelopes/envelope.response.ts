import type { envelopes } from '../../db/schema';

export type Envelope = typeof envelopes.$inferSelect;

/** DTO de sortie explicite : découple le contrat HTTP du schéma Drizzle brut. */
export function toEnvelopeResponse(row: Envelope) {
  return {
    id: row.id,
    memberId: row.memberId,
    name: row.name,
    type: row.type,
    balance: row.balance,
    target: row.target,
    color: row.color,
    dueDay: row.dueDay,
    encryptedData: row.encryptedData,
  };
}
