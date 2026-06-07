import * as z from 'zod/mini';
import { Expect, MutualAssign } from '@core/types/assert-equal';
import { Prescription } from '../../domain/models/prescription.model';

export const PrescriptionSchema = z.object({
  id: z.string(),
  appointmentId: z.nullable(z.string()),
  practitionerId: z.nullable(z.string()),
  patientId: z.string(),
  issuedDate: z.string(),
  validUntil: z.nullable(z.string()),
  documentUrl: z.nullable(z.string()),
  notes: z.nullable(z.string()),
});

// Garde-fou : si Prescription évolue sans ce schéma, le build casse.
type _Check = Expect<MutualAssign<z.infer<typeof PrescriptionSchema>, Prescription>>;
