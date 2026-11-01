import * as z from 'zod/mini';
import { Expect, MutualAssign } from '@core/types/assert-equal';
import { Patient } from '../../domain/models/patient.model';

export const PatientSchema = z.object({
  id: z.string(),
  firstName: z.string(),
  lastName: z.string(),
  birthDate: z.string(),
  notes: z.nullable(z.string()),
});

// Garde-fou : si Patient évolue sans ce schéma, le build casse.
type _Check = Expect<MutualAssign<z.infer<typeof PatientSchema>, Patient>>;
