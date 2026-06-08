import { describe, expect, it } from 'vitest';
import { buildForecasts } from './analytics-forecasts';
import { Envelope } from './models/envelope.model';
import { Loan } from './models/loan.model';

const env = (p: Partial<Envelope>): Envelope => ({
  id: 'e',
  memberId: null,
  name: 'Vacances',
  type: 'épargne',
  balance: 0,
  target: null,
  color: '#0ff',
  dueDay: null,
  ...p,
});
const loan = (p: Partial<Loan>): Loan => ({
  id: 'l',
  memberId: null,
  person: 'Alice',
  direction: 'lent',
  amount: 0,
  remaining: 0,
  description: '',
  date: '2026-01-01',
  dueDate: null,
  dueDay: null,
  ...p,
});

describe('buildForecasts', () => {
  it('surplus si net > 0', () => {
    expect(
      buildForecasts({
        net: 300,
        envelopes: [],
        loans: [],
        envelopeCredits: 0,
        loanPayments: 0,
      })[0],
    ).toEqual({ kind: 'surplus', net: 300 });
  });
  it('deficit si net < 0', () => {
    expect(
      buildForecasts({
        net: -120,
        envelopes: [],
        loans: [],
        envelopeCredits: 0,
        loanPayments: 0,
      })[0],
    ).toEqual({ kind: 'deficit', net: -120 });
  });
  it('enveloppe sous cible : monthsToTarget = ceil(remaining/contrib)', () => {
    const out = buildForecasts({
      net: 0,
      loans: [],
      loanPayments: 0,
      envelopes: [env({ name: 'Vacances', balance: 100, target: 400 })],
      envelopeCredits: 50,
    });
    expect(out.find((x) => x.kind === 'envelope')).toMatchObject({
      kind: 'envelope',
      name: 'Vacances',
      remaining: 300,
      contrib: 50,
      monthsToTarget: 6,
    });
  });
  it('enveloppe sans contrib : monthsToTarget null', () => {
    const out = buildForecasts({
      net: 0,
      loans: [],
      loanPayments: 0,
      envelopes: [env({ balance: 100, target: 400 })],
      envelopeCredits: 0,
    });
    expect(out.find((x) => x.kind === 'envelope')).toMatchObject({
      kind: 'envelope',
      monthsToTarget: null,
    });
  });
  it('prêt actif : pct et monthsToClear', () => {
    const out = buildForecasts({
      net: 0,
      envelopes: [],
      envelopeCredits: 0,
      loans: [loan({ person: 'Bob', amount: 1000, remaining: 600, direction: 'borrowed' })],
      loanPayments: 200,
    });
    expect(out.find((x) => x.kind === 'loan')).toMatchObject({
      kind: 'loan',
      person: 'Bob',
      direction: 'borrowed',
      remaining: 600,
      payment: 200,
      monthsToClear: 3,
      pct: 40,
    });
  });
});
