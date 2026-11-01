import { z } from 'zod';

const uuid = z.string().uuid();
const dateStr = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Format date invalide (YYYY-MM-DD)');
const timeStr = z
  .string()
  .regex(/^\d{2}:\d{2}$/, 'Format heure invalide (HH:MM)');

const APPOINTMENT_STATUSES = [
  'scheduled',
  'completed',
  'cancelled',
  'no_show',
] as const;

export const createAppointmentSchema = z.object({
  patientId: uuid,
  practitionerId: uuid,
  date: dateStr,
  time: timeStr,
  status: z.enum(APPOINTMENT_STATUSES).optional().default('scheduled'),
  reason: z.string().max(1000).nullable().optional(),
  outcome: z.string().max(2000).nullable().optional(),
});

export const createEncryptedAppointmentSchema = z.object({
  patientId: uuid,
  practitionerId: uuid,
  encryptedData: z.string().min(1),
});

export const updateAppointmentStatusSchema = z.object({
  status: z.enum(APPOINTMENT_STATUSES),
});

export const updateAppointmentSchema = z.object({
  patientId: uuid.optional(),
  practitionerId: uuid.optional(),
  date: dateStr.optional(),
  time: timeStr.optional(),
  status: z.enum(APPOINTMENT_STATUSES).optional(),
  reason: z.string().max(1000).nullable().optional(),
  outcome: z.string().max(2000).nullable().optional(),
});

export const updateEncryptedAppointmentSchema = z.object({
  patientId: uuid.optional(),
  practitionerId: uuid.optional(),
  encryptedData: z.string().min(1),
});
