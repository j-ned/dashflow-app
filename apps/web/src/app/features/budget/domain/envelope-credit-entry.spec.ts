import { describe, expect, it } from 'vitest';
import { Envelope } from './models/envelope.model';
import { buildEnvelopeCreditEntry } from './envelope-credit-entry';

const ENV: Envelope = {
  id: 'e1',
  memberId: 'm1',
  name: 'Vacances',
  type: 'vacances',
  balance: 300,
  target: null,
  color: '#0f0',
  dueDay: null,
};

const LABELS = { label: 'Crédit Vacances', category: 'Enveloppe' };

describe('buildEnvelopeCreditEntry', () => {
  it('mappe vers une écriture spending avec compte source, montant, date, membre et libellés', () => {
    const entry = buildEnvelopeCreditEntry(
      ENV,
      { amount: 50, date: '2026-06-01', note: 'épargne', accountId: 'acc1' },
      LABELS,
    );
    expect(entry.type).toBe('spending');
    expect(entry.amount).toBe(50);
    expect(entry.accountId).toBe('acc1');
    expect(entry.memberId).toBe('m1');
    expect(entry.date).toBe('2026-06-01');
    expect(entry.label).toBe('Crédit Vacances');
    expect(entry.category).toBe('Enveloppe');
    expect(entry.dayOfMonth).toBeNull();
    expect(entry.endDate).toBeNull();
    expect(entry.toAccountId).toBeNull();
    expect(entry.payslipKey).toBeNull();
    expect(entry.autoPost).toBe(false);
    expect(entry.autoPostSince).toBeNull();
  });

  it('date vide → null', () => {
    const entry = buildEnvelopeCreditEntry(
      ENV,
      { amount: 50, date: '', note: null, accountId: 'acc1' },
      LABELS,
    );
    expect(entry.date).toBeNull();
  });
});
