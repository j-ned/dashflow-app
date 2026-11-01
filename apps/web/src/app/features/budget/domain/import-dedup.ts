import { ParsedTransaction } from './models/parsed-transaction.model';
import { foldText } from './fold-text';

function fingerprint(date: string, amount: number, label: string | null): string {
  // Number() : robuste si un montant arrive en string (numeric postgres non coercé) → empreinte stable.
  return `${date}|${Number(amount)}|${foldText(label)}`;
}

export type ExistingTx = { date: string; amount: number; note: string | null };

export function markDuplicates(
  parsed: readonly ParsedTransaction[],
  existing: readonly ExistingTx[],
): (ParsedTransaction & { duplicate: boolean })[] {
  const seen = new Set(existing.map((e) => fingerprint(e.date, e.amount, e.note)));
  return parsed.map((t) => ({ ...t, duplicate: seen.has(fingerprint(t.date, t.amount, t.label)) }));
}
