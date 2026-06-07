import * as z from 'zod/mini';
import { Expect, MutualAssign } from '@core/types/assert-equal';
import { SalaryArchive } from '../../domain/models/salary-archive.model';

const SpendingSnapshotSchema = z.object({
  label: z.string(),
  amount: z.number(),
  date: z.nullable(z.string()),
  category: z.nullable(z.string()),
});

export const SalaryArchiveSchema = z.object({
  id: z.string(),
  accountId: z.nullable(z.string()),
  month: z.string(),
  salary: z.number(),
  totalExpenses: z.number(),
  totalSpendings: z.number(),
  spendings: z.array(SpendingSnapshotSchema),
  payslipKey: z.nullable(z.string()),
});

// Garde-fou anti-dérive : si SalaryArchive évolue sans ce schéma, le build casse.
type _Check = Expect<MutualAssign<z.infer<typeof SalaryArchiveSchema>, SalaryArchive>>;
