import { z } from 'zod';

const optionalUuid = z.string().uuid().nullable().optional();
const dateStr = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Format date invalide (YYYY-MM-DD)');
const amount = z.union([z.string(), z.number()]).transform(String);

const LOAN_DIRECTIONS = ['lent', 'borrowed'] as const;

export const createLoanSchema = z.object({
  memberId: optionalUuid,
  person: z.string().min(1).max(255),
  direction: z.enum(LOAN_DIRECTIONS),
  amount,
  remaining: amount,
  description: z.string().max(1000).nullable().optional(),
  date: dateStr,
  dueDate: dateStr.nullable().optional(),
  dueDay: z.number().int().min(1).max(31).nullable().optional(),
});

export const createEncryptedLoanSchema = z.object({
  memberId: optionalUuid,
  direction: z.enum(LOAN_DIRECTIONS).optional(),
  encryptedData: z.string().min(1),
});

export const loanTransactionSchema = z.object({
  amount: z.number(),
  date: dateStr,
});

export const loanPaymentSchema = z.object({
  amount: z.number().positive('Le montant doit etre positif'),
  date: dateStr.optional(),
  note: z.string().max(255).nullable().optional(),
});
