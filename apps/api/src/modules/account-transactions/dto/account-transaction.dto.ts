import { z } from 'zod';

const optionalUuid = z.string().uuid().nullable().optional();
const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format date invalide (YYYY-MM-DD)');
const amount = z.union([z.string(), z.number()]).transform(String);

const DIRECTIONS = ['income', 'expense', 'transfer'] as const;

export const createTransactionSchema = z.object({
  amount,
  direction: z.enum(DIRECTIONS),
  toAccountId: optionalUuid,
  date: dateStr,
  category: z.string().max(100).nullable().optional(),
  note: z.string().max(255).nullable().optional(),
  memberId: optionalUuid,
  recurringEntryId: optionalUuid,
});

export const createEncryptedTransactionSchema = z.object({
  direction: z.enum(DIRECTIONS),
  toAccountId: optionalUuid,
  memberId: optionalUuid,
  recurringEntryId: optionalUuid,
  encryptedData: z.string().min(1),
});

export type CreateTransactionDto = z.infer<typeof createTransactionSchema>;
export type CreateEncryptedTransactionDto = z.infer<typeof createEncryptedTransactionSchema>;

export const batchTransactionSchema = z.object({
  items: z.array(z.record(z.string(), z.unknown())).min(1).max(1000),
});
export type BatchTransactionDto = z.infer<typeof batchTransactionSchema>;
