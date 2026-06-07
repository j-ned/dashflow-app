import { Envelope } from './models/envelope.model';
import { EnvelopeTransaction } from './models/envelope-transaction.model';

export type HistoryEntry = { readonly tx: EnvelopeTransaction; readonly balanceAfter: number };

// Running balance per envelope, newest first; zero-amount rows (legacy E2EE snapshots) excluded.
export function buildEnvelopeHistories(
  envelopes: readonly Envelope[],
  transactions: readonly EnvelopeTransaction[],
): Map<string, HistoryEntry[]> {
  const byEnvelope = new Map<string, EnvelopeTransaction[]>();
  for (const tx of transactions) {
    if (Number(tx.amount) === 0) continue;
    const list = byEnvelope.get(tx.envelopeId);
    if (list) list.push(tx);
    else byEnvelope.set(tx.envelopeId, [tx]);
  }
  const result = new Map<string, HistoryEntry[]>();
  for (const envelope of envelopes) {
    const txs = (byEnvelope.get(envelope.id) ?? [])
      .slice()
      .sort((a, b) => b.date.localeCompare(a.date));
    let balance = Number(envelope.balance);
    const entries: HistoryEntry[] = txs.map((tx) => {
      const entry: HistoryEntry = { tx, balanceAfter: balance };
      balance -= Number(tx.amount);
      return entry;
    });
    result.set(envelope.id, entries);
  }
  return result;
}
