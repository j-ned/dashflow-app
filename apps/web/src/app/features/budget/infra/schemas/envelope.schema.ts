import * as z from 'zod/mini';
import { Expect, MutualAssign } from '@core/types/assert-equal';
import { Envelope } from '../../domain/models/envelope.model';

export const EnvelopeSchema = z.object({
  id: z.string(),
  memberId: z.nullable(z.string()),
  name: z.string(),
  type: z.enum(['épargne', 'impôts', 'équipement', 'vacances']),
  balance: z.number(),
  target: z.nullable(z.number()),
  color: z.string(),
  dueDay: z.nullable(z.number()),
});

// Garde-fou anti-dérive : si Envelope évolue sans ce schéma, le build casse.
type _Check = Expect<MutualAssign<z.infer<typeof EnvelopeSchema>, Envelope>>;
