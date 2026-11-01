import * as z from 'zod/mini';
import { Expect, MutualAssign } from '@core/types/assert-equal';
import { Medication } from '../../domain/models/medication.model';

export const MedicationSchema = z.object({
  id: z.string(),
  prescriptionId: z.nullable(z.string()),
  patientId: z.string(),
  name: z.string(),
  type: z.enum(['comprime', 'gelule', 'sirop', 'patch', 'injection', 'gouttes', 'creme', 'autre']),
  dosage: z.string(),
  quantity: z.number(),
  dailyRate: z.number(),
  startDate: z.string(),
  alertDaysBefore: z.number(),
  skipDays: z.array(z.number()),
});

// Garde-fou : si Medication évolue sans ce schéma, le build casse.
type _Check = Expect<MutualAssign<z.infer<typeof MedicationSchema>, Medication>>;
