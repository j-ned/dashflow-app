import { z } from 'zod';

// Un rappel est un raccourci d'export calendrier fabriqué dans le navigateur : l'API n'envoie rien.
// `type` et `recipientEmail`, encore envoyés par un front plus ancien, sont ignorés (clés inconnues).

export const createReminderSchema = z
  .object({
    target: z.enum(['medication', 'appointment']),
    medicationId: z.string().uuid().optional(),
    appointmentId: z.string().uuid().optional(),
    enabled: z.boolean().optional(),
  })
  // Un rappel sans sa cible ne pourrait jamais être émis (doublé par un CHECK en base).
  .refine(
    (d) => (d.target === 'medication' ? !!d.medicationId : !!d.appointmentId),
    {
      message: 'La cible du rappel (medicationId ou appointmentId) est requise',
      path: ['target'],
    },
  );

export const updateReminderSchema = z.object({
  target: z.enum(['medication', 'appointment']).optional(),
  medicationId: z.string().uuid().nullable().optional(),
  appointmentId: z.string().uuid().nullable().optional(),
  enabled: z.boolean().optional(),
});
