import * as z from 'zod/mini';
import { Expect, MutualAssign } from '@core/types/assert-equal';
import { Appointment } from '../../domain/models/appointment.model';

export const AppointmentSchema = z.object({
  id: z.string(),
  patientId: z.string(),
  practitionerId: z.string(),
  date: z.string(),
  time: z.string(),
  status: z.enum(['scheduled', 'completed', 'cancelled', 'no_show']),
  reason: z.nullable(z.string()),
  outcome: z.nullable(z.string()),
});

// Garde-fou : si Appointment évolue sans ce schéma, le build casse.
type _Check = Expect<MutualAssign<z.infer<typeof AppointmentSchema>, Appointment>>;
