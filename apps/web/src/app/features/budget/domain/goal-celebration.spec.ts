import { describe, expect, it } from 'vitest';
import { Envelope } from './models/envelope.model';
import { Loan } from './models/loan.model';
import { envelopeGoalJustReached, loanJustSettled } from './goal-celebration';

const ENV: Envelope = {
  id: 'e1',
  memberId: null,
  name: 'Vacances',
  type: 'vacances',
  balance: 0,
  target: 500,
  color: '#0f0',
  dueDay: null,
};

const LOAN: Loan = {
  id: 'l1',
  memberId: null,
  person: 'Alice',
  direction: 'lent',
  amount: 100,
  remaining: 100,
  description: '',
  date: '2026-01-01',
  dueDate: null,
  dueDay: null,
};

describe('envelopeGoalJustReached', () => {
  it.each([
    { balance: 480, amount: 20, expected: true },
    { balance: 480, amount: 50, expected: true },
    { balance: 100, amount: 50, expected: false },
    { balance: 500, amount: 50, expected: false },
    { balance: 480, amount: 0, expected: false },
    { balance: 480, amount: -50, expected: false },
  ])('balance=$balance amount=$amount → $expected', ({ balance, amount, expected }) => {
    expect(envelopeGoalJustReached({ ...ENV, balance }, amount)).toBe(expected);
  });

  it('sans objectif → toujours false', () => {
    expect(envelopeGoalJustReached({ ...ENV, target: null, balance: 480 }, 20)).toBe(false);
  });
});

describe('loanJustSettled', () => {
  it.each([
    { remaining: 100, amount: 100, expected: true },
    { remaining: 100, amount: 150, expected: true },
    { remaining: 100, amount: 40, expected: false },
    { remaining: 0, amount: 50, expected: false },
    { remaining: 100, amount: 0, expected: false },
    { remaining: 100, amount: -20, expected: false },
  ])('remaining=$remaining amount=$amount → $expected', ({ remaining, amount, expected }) => {
    expect(loanJustSettled({ ...LOAN, remaining }, amount)).toBe(expected);
  });
});
