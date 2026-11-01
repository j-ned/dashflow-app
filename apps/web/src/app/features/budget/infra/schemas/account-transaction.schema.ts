import * as z from 'zod/mini';
import { Expect, MutualAssign } from '@core/types/assert-equal';
import { AccountTransaction } from '../../domain/models/account-transaction.model';

export const AccountTransactionSchema = z.object({
  id: z.string(),
  accountId: z.string(),
  amount: z.number(),
  direction: z.enum(['income', 'expense', 'transfer']),
  toAccountId: z.nullable(z.string()),
  date: z.string(),
  category: z.nullable(z.string()),
  note: z.nullable(z.string()),
  memberId: z.nullable(z.string()),
  recurringEntryId: z.nullable(z.string()),
});

// Garde-fou anti-dérive : si AccountTransaction évolue sans ce schéma, le build casse.
type _Check = Expect<MutualAssign<z.infer<typeof AccountTransactionSchema>, AccountTransaction>>;
