import { z } from 'zod';

const optionalUuid = z.string().uuid().nullable().optional();
const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format date invalide (YYYY-MM-DD)');
const amount = z.union([z.string(), z.number()]).transform(String);

const RECURRING_TYPES = ['income', 'expense', 'annual_expense', 'spending', 'transfer'] as const;

export const createRecurringEntrySchema = z.object({
  memberId: optionalUuid,
  accountId: optionalUuid,
  toAccountId: optionalUuid,
  label: z.string().min(1).max(255),
  amount,
  type: z.enum(RECURRING_TYPES),
  dayOfMonth: z.number().int().min(1).max(31).nullable().optional(),
  date: dateStr.nullable().optional(),
  endDate: dateStr.nullable().optional(),
  category: z.string().max(100).nullable().optional(),
});

export const createEncryptedRecurringEntrySchema = z.object({
  memberId: optionalUuid,
  accountId: optionalUuid,
  toAccountId: optionalUuid,
  encryptedData: z.string().min(1),
});
