import { z } from 'zod';

export const createReminderSchema = z.object({
  type: z.enum(['email', 'ical']),
  target: z.enum(['medication', 'appointment']),
  medicationId: z.string().uuid().optional(),
  appointmentId: z.string().uuid().optional(),
  recipientEmail: z.string().email(),
  enabled: z.boolean().optional(),
});

export const updateReminderSchema = z.object({
  type: z.enum(['email', 'ical']).optional(),
  target: z.enum(['medication', 'appointment']).optional(),
  medicationId: z.string().uuid().nullable().optional(),
  appointmentId: z.string().uuid().nullable().optional(),
  recipientEmail: z.string().email().optional(),
  enabled: z.boolean().optional(),
});
