import { describe, expect, it } from 'vitest';
import { Envelope } from './models/envelope.model';
import { EnvelopeTransaction } from './models/envelope-transaction.model';
import { buildEnvelopeHistories } from './envelope-history';

function env(over: Partial<Envelope> = {}): Envelope {
  return {
    id: 'e1',
    memberId: null,
    name: 'Vacances',
    type: 'vacances',
    balance: 300,
    target: null,
    color: '#0f0',
    dueDay: null,
    ...over,
  };
}

function tx(over: Partial<EnvelopeTransaction> = {}): EnvelopeTransaction {
  return { id: 't1', envelopeId: 'e1', amount: 100, date: '2026-01-01', note: null, ...over };
}

describe('buildEnvelopeHistories', () => {
  it('groupe par enveloppe, trie par date desc, calcule balanceAfter depuis le solde courant', () => {
    const result = buildEnvelopeHistories(
      [env({ id: 'e1', balance: 300 })],
      [
        tx({ id: 'old', amount: 100, date: '2026-01-01' }),
        tx({ id: 'recent', amount: 50, date: '2026-03-01' }),
      ],
    );
    const entries = result.get('e1')!;
    expect(entries.map((e) => e.tx.id)).toEqual(['recent', 'old']);
    expect(entries[0].balanceAfter).toBe(300);
    expect(entries[1].balanceAfter).toBe(250);
  });

  it('exclut les transactions à montant 0 (snapshots E2EE legacy)', () => {
    const result = buildEnvelopeHistories(
      [env({ id: 'e1' })],
      [tx({ id: 'zero', amount: 0 }), tx({ id: 'real', amount: 20 })],
    );
    expect(result.get('e1')!.map((e) => e.tx.id)).toEqual(['real']);
  });

  it('enveloppe sans transaction → liste vide', () => {
    const result = buildEnvelopeHistories(
      [env({ id: 'e1' }), env({ id: 'e2' })],
      [tx({ envelopeId: 'e1' })],
    );
    expect(result.get('e2')).toEqual([]);
  });

  it('ignore les transactions d’une enveloppe absente de la liste', () => {
    const result = buildEnvelopeHistories([env({ id: 'e1' })], [tx({ envelopeId: 'ghost' })]);
    expect(result.has('ghost')).toBe(false);
    expect(result.get('e1')).toEqual([]);
  });
});
