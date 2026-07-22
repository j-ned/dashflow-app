import { z } from 'zod';

const uuid = z.string().uuid();
const optionalUuid = z.string().uuid().nullable().optional();
const dateStr = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Format date invalide (YYYY-MM-DD)');

export const createPrescriptionSchema = z.object({
  appointmentId: optionalUuid,
  practitionerId: optionalUuid,
  patientId: uuid,
  issuedDate: dateStr,
  validUntil: dateStr.nullable().optional(),
  documentUrl: z.string().nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
});

export const createEncryptedPrescriptionSchema = z.object({
  appointmentId: optionalUuid,
  practitionerId: optionalUuid,
  patientId: uuid,
  encryptedData: z.string().min(1),
});

export const updatePrescriptionSchema = z.object({
  appointmentId: optionalUuid,
  practitionerId: optionalUuid,
  patientId: uuid.optional(),
  issuedDate: dateStr.optional(),
  validUntil: dateStr.nullable().optional(),
  documentUrl: z.string().nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
});

export const updateEncryptedPrescriptionSchema = z.object({
  appointmentId: optionalUuid,
  practitionerId: optionalUuid,
  patientId: uuid.optional(),
  encryptedData: z.string().min(1),
});
