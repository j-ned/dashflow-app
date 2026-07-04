import { z } from 'zod';

const uuid = z.string().uuid();
const optionalUuid = z.string().uuid().nullable().optional();
const dateStr = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Format date invalide (YYYY-MM-DD)');
const amount = z.union([z.string(), z.number()]).transform(String);

const MEDICATION_TYPES = [
  'comprime',
  'gelule',
  'sirop',
  'patch',
  'injection',
  'gouttes',
  'creme',
  'autre',
] as const;

export const createMedicationSchema = z.object({
  prescriptionId: optionalUuid,
  patientId: uuid,
  name: z.string().min(1).max(255),
  type: z.enum(MEDICATION_TYPES),
  dosage: z.string().min(1).max(100),
  quantity: z.number().int().min(0).optional().default(0),
  dailyRate: amount.optional().default('1'),
  startDate: dateStr,
  alertDaysBefore: z.number().int().min(0).max(90).optional().default(7),
  skipDays: z.array(z.number().int().min(0).max(6)).optional().default([]),
});

export const createEncryptedMedicationSchema = z.object({
  prescriptionId: optionalUuid,
  patientId: uuid,
  encryptedData: z.string().min(1),
});

export const refillMedicationSchema = z.object({
  quantity: z.number().int().positive('La quantite doit etre positive'),
});
