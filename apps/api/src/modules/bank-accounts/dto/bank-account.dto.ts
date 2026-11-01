import { z } from 'zod';
import { moneyNumber } from '../../../common/money';

const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/);

const BANK_ACCOUNT_TYPES = ['courant', 'épargne', 'carte', 'espèces'] as const;

export const createBankAccountSchema = z.object({
  name: z.string().min(1).max(255),
  type: z.enum(BANK_ACCOUNT_TYPES).optional(),
  initialBalance: moneyNumber.optional(),
  // null accepté comme à la mise à jour : le front envoie `color: null` tant qu'aucune couleur n'est choisie
  color: hexColor.nullable().optional(),
  dotColor: hexColor.nullable().optional(),
});

export const createEncryptedBankAccountSchema = z.object({
  encryptedData: z.string().min(1),
});

export const updateBankAccountSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  type: z.enum(BANK_ACCOUNT_TYPES).optional(),
  initialBalance: moneyNumber.optional(),
  color: hexColor.nullable().optional(),
  dotColor: hexColor.nullable().optional(),
});

export const updateEncryptedBankAccountSchema = z.object({
  encryptedData: z.string().min(1),
});
