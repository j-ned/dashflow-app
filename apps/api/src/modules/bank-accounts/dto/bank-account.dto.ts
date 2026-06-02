import { z } from 'zod';

const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/);

export const BANK_ACCOUNT_TYPES = ['courant', 'épargne', 'carte', 'espèces'] as const;

export const createBankAccountSchema = z.object({
  name: z.string().min(1).max(255),
  type: z.enum(BANK_ACCOUNT_TYPES).optional(),
  initialBalance: z.coerce.number().optional(),
  color: hexColor.optional(),
  dotColor: hexColor.optional(),
});

export const createEncryptedBankAccountSchema = z.object({ encryptedData: z.string().min(1) });
