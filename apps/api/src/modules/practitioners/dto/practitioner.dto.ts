import { z } from 'zod';

const PRACTITIONER_TYPES = [
  'generaliste', 'pediatre', 'psychiatre', 'neurologue', 'ophtalmologue',
  'dentiste', 'orthodontiste', 'orthophoniste', 'psychologue', 'psychomotricien',
  'ergotherapeute', 'kinesitherapeute', 'dermatologue', 'cardiologue', 'autre',
] as const;

export const createPractitionerSchema = z.object({
  name: z.string().min(1).max(255),
  type: z.enum(PRACTITIONER_TYPES),
  phone: z.string().max(50).nullable().optional(),
  email: z.string().email().max(255).nullable().optional(),
  address: z.string().max(500).nullable().optional(),
  bookingUrl: z.string().url().max(1000).nullable().optional(),
});

export const createEncryptedPractitionerSchema = z.object({
  encryptedData: z.string().min(1),
});
