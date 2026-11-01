import * as z from 'zod/mini';
import { Expect, MutualAssign } from '@core/types/assert-equal';
import { Loan } from '../../domain/models/loan.model';

export const LoanSchema = z.object({
  id: z.string(),
  memberId: z.nullable(z.string()),
  person: z.string(),
  direction: z.enum(['lent', 'borrowed']),
  amount: z.number(),
  remaining: z.number(),
  description: z.string(),
  date: z.string(),
  dueDate: z.nullable(z.string()),
  dueDay: z.nullable(z.number()),
});

// Garde-fou anti-dérive : si Loan évolue sans ce schéma, le build casse.
type _Check = Expect<MutualAssign<z.infer<typeof LoanSchema>, Loan>>;
