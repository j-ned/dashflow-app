import * as z from 'zod/mini';
import { Expect, MutualAssign } from '@core/types/assert-equal';
import { Practitioner } from '../../domain/models/practitioner.model';

export const PractitionerSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.enum([
    'generaliste',
    'pediatre',
    'psychiatre',
    'neurologue',
    'ophtalmologue',
    'dentiste',
    'orthodontiste',
    'orthophoniste',
    'psychologue',
    'psychomotricien',
    'ergotherapeute',
    'kinesitherapeute',
    'dermatologue',
    'cardiologue',
    'autre',
  ]),
  phone: z.nullable(z.string()),
  email: z.nullable(z.string()),
  address: z.nullable(z.string()),
  bookingUrl: z.nullable(z.string()),
});

// Garde-fou : si Practitioner évolue sans ce schéma, le build casse.
type _Check = Expect<MutualAssign<z.infer<typeof PractitionerSchema>, Practitioner>>;
