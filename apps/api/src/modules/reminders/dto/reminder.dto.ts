import { z } from 'zod';

export const createReminderSchema = z.object({
  type: z.enum(['email', 'ical']),
  target: z.enum(['medication', 'appointment']),
  medicationId: z.string().uuid().optional(),
  appointmentId: z.string().uuid().optional(),
  recipientEmail: z.string().email(),
  enabled: z.boolean().optional(),
});
