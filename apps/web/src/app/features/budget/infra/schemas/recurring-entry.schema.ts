import * as z from 'zod/mini';
import { Expect, MutualAssign } from '@core/types/assert-equal';
import { RecurringEntry } from '../../domain/models/recurring-entry.model';

export const RecurringEntrySchema = z.object({
  id: z.string(),
  memberId: z.nullable(z.string()),
  accountId: z.nullable(z.string()),
  toAccountId: z.nullable(z.string()),
  label: z.string(),
  amount: z.number(),
  type: z.enum(['income', 'expense', 'annual_expense', 'spending', 'transfer']),
  dayOfMonth: z.nullable(z.number()),
  date: z.nullable(z.string()),
  endDate: z.nullable(z.string()),
  category: z.nullable(z.string()),
  payslipKey: z.nullable(z.string()),
  autoPost: z.boolean(),
  autoPostSince: z.nullable(z.string()),
});

// Garde-fou anti-dérive : si RecurringEntry évolue sans ce schéma, le build casse.
type _Check = Expect<MutualAssign<z.infer<typeof RecurringEntrySchema>, RecurringEntry>>;
