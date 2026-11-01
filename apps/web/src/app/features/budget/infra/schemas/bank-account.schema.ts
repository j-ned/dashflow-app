import * as z from 'zod/mini';
import { Expect, MutualAssign } from '@core/types/assert-equal';
import { BankAccount } from '../../domain/models/bank-account.model';

export const BankAccountSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.enum(['courant', 'épargne', 'carte', 'espèces']),
  initialBalance: z.number(),
  color: z.nullable(z.string()),
  dotColor: z.nullable(z.string()),
});

// Garde-fou : si BankAccount évolue sans ce schéma, le build casse.
type _Check = Expect<MutualAssign<z.infer<typeof BankAccountSchema>, BankAccount>>;
