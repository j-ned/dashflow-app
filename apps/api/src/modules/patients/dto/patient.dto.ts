import { z } from 'zod';

const dateStr = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Format date invalide (YYYY-MM-DD)');
const hexColor = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/)
  .nullable()
  .optional();

export const createPatientSchema = z.object({
  firstName: z.string().min(1).max(255),
  lastName: z.string().min(1).max(255),
  birthDate: dateStr,
  color: hexColor,
  notes: z.string().max(2000).nullable().optional(),
});

export const createEncryptedPatientSchema = z.object({
  encryptedData: z.string().min(1),
});
