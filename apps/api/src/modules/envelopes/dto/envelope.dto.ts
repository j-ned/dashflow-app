import { z } from 'zod';

const optionalUuid = z.string().uuid().nullable().optional();
const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format date invalide (YYYY-MM-DD)');
const amount = z.union([z.string(), z.number()]).transform(String);
const color = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Couleur invalide (#RRGGBB)').nullable().optional();

const ENVELOPE_TYPES = ['épargne', 'impôts', 'équipement', 'vacances'] as const;

export const createEnvelopeSchema = z.object({
  memberId: optionalUuid,
  name: z.string().min(1).max(255),
  type: z.enum(ENVELOPE_TYPES),
  balance: amount.optional().default('0'),
  target: amount.nullable().optional(),
  color,
  dueDay: z.number().int().min(1).max(31).nullable().optional(),
});

export const createEncryptedEnvelopeSchema = z.object({
  memberId: optionalUuid,
  encryptedData: z.string().min(1),
});

const note = z.string().max(255).nullable().optional();

export const envelopeTransactionSchema = z.object({
  amount: z.number(),
  date: dateStr,
  note,
});

export const creditEnvelopeSchema = z.object({
  amount: z.number(),
  date: dateStr.optional(),
  note,
});

export const creditEncryptedEnvelopeSchema = z.object({
  encryptedData: z.string().min(1),
});
