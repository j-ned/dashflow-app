import { z } from 'zod';

const amount = z.union([z.string(), z.number()]).transform(String);

export const createSalaryArchiveSchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/, 'Format mois invalide (YYYY-MM)'),
  salary: amount,
  totalExpenses: amount.optional().default('0'),
  totalSpendings: amount.optional().default('0'),
  spendings: z.array(z.unknown()).optional().default([]),
  accountId: z.string().uuid().nullable().optional(),
});

export const createEncryptedSalaryArchiveSchema = z.object({
  accountId: z.string().uuid().nullable().optional(),
  encryptedData: z.string().min(1),
});
