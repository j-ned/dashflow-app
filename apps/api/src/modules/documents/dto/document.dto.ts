import { z } from 'zod';

const uuid = z.string().uuid();
const optionalUuid = z.string().uuid().nullable().optional();
const dateStr = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Format date invalide (YYYY-MM-DD)');

const DOCUMENT_TYPES = [
  'compte_rendu',
  'facture',
  'bilan',
  'certificat',
  'courrier',
  'autre',
] as const;

export const createDocumentSchema = z.object({
  patientId: uuid,
  practitionerId: optionalUuid,
  type: z.enum(DOCUMENT_TYPES),
  title: z.string().min(1).max(255),
  date: dateStr,
  fileUrl: z.string().nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
});

export const createEncryptedDocumentSchema = z.object({
  patientId: uuid,
  practitionerId: optionalUuid,
  encryptedData: z.string().min(1),
});
