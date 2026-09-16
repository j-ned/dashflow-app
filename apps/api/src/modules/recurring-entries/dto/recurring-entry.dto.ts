import { z } from 'zod';
import { nonNegativeMoney as amount } from '../../../common/money';

const optionalUuid = z.string().uuid().nullable().optional();
const dateStr = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Format date invalide (YYYY-MM-DD)');

const RECURRING_TYPES = [
  'income',
  'expense',
  'annual_expense',
  'spending',
  'transfer',
] as const;

// Cohérences inter-champs (doublées par des CHECK en base ; l'update partiel s'appuie sur eux).
const notSelfTransfer = {
  check: (d: { accountId?: string | null; toAccountId?: string | null }) =>
    !d.accountId || !d.toAccountId || d.accountId !== d.toAccountId,
  message: "Un virement ne peut pas cibler le compte d'origine",
  path: ['toAccountId'],
};
const endAfterStart = {
  check: (d: { date?: string | null; endDate?: string | null }) =>
    !d.date || !d.endDate || d.endDate >= d.date,
  message: 'La date de fin ne peut pas précéder la date de début',
  path: ['endDate'],
};

export const createRecurringEntrySchema = z
  .object({
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
  })
  .refine(notSelfTransfer.check, notSelfTransfer)
  .refine(endAfterStart.check, endAfterStart);

export const createEncryptedRecurringEntrySchema = z
  .object({
    memberId: optionalUuid,
    accountId: optionalUuid,
    toAccountId: optionalUuid,
    encryptedData: z.string().min(1),
  })
  .refine(notSelfTransfer.check, notSelfTransfer);

export const updateRecurringEntrySchema = z
  .object({
    memberId: optionalUuid,
    accountId: optionalUuid,
    toAccountId: optionalUuid,
    label: z.string().min(1).max(255).optional(),
    amount: amount.optional(),
    type: z.enum(RECURRING_TYPES).optional(),
    dayOfMonth: z.number().int().min(1).max(31).nullable().optional(),
    date: dateStr.nullable().optional(),
    endDate: dateStr.nullable().optional(),
    category: z.string().max(100).nullable().optional(),
  })
  .refine(notSelfTransfer.check, notSelfTransfer)
  .refine(endAfterStart.check, endAfterStart);

export const updateEncryptedRecurringEntrySchema = z
  .object({
    memberId: optionalUuid,
    accountId: optionalUuid,
    toAccountId: optionalUuid,
    encryptedData: z.string().min(1),
  })
  .refine(notSelfTransfer.check, notSelfTransfer);
