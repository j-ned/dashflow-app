import * as z from 'zod/mini';
import { Expect, MutualAssign } from '@core/types/assert-equal';
import { Member } from '../../domain/models/member.model';

export const MemberSchema = z.object({
  id: z.string(),
  firstName: z.string(),
  lastName: z.string(),
  color: z.nullable(z.string()),
});

// Garde-fou anti-dérive : si Member évolue sans ce schéma, le build casse.
type _Check = Expect<MutualAssign<z.infer<typeof MemberSchema>, Member>>;
