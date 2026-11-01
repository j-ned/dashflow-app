import { z } from 'zod';
import { money, moneyNumber, nonNegativeMoney } from '../../../common/money';
import { ENVELOPE_TYPES } from '../../../db/schema';

const optionalUuid = z.string().uuid().nullable().optional();
const dateStr = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Format date invalide (YYYY-MM-DD)');
const color = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/, 'Couleur invalide (#RRGGBB)')
  .nullable()
  .optional();

export const createEnvelopeSchema = z.object({
  memberId: optionalUuid,
  name: z.string().min(1).max(255),
  type: z.enum(ENVELOPE_TYPES),
  balance: money.optional().default('0.00'),
  target: nonNegativeMoney.nullable().optional(),
  color,
  dueDay: z.number().int().min(1).max(31).nullable().optional(),
});

export const createEncryptedEnvelopeSchema = z.object({
  memberId: optionalUuid,
  encryptedData: z.string().min(1),
});

export const updateEnvelopeSchema = z.object({
  memberId: optionalUuid,
  name: z.string().min(1).max(255).optional(),
  type: z.enum(ENVELOPE_TYPES).optional(),
  balance: money.optional(),
  target: nonNegativeMoney.nullable().optional(),
  color,
  dueDay: z.number().int().min(1).max(31).nullable().optional(),
});

export const updateEncryptedEnvelopeSchema = z.object({
  memberId: optionalUuid,
  encryptedData: z.string().min(1),
});

const note = z.string().max(255).nullable().optional();

export const envelopeTransactionSchema = z.object({
  amount: moneyNumber,
  date: dateStr,
  note,
});

export const creditEnvelopeSchema = z.object({
  amount: moneyNumber,
  date: dateStr.optional(),
  note,
});

export const creditEncryptedEnvelopeSchema = z.object({
  encryptedData: z.string().min(1),
});
