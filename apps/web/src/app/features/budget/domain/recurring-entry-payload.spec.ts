import { describe, expect, it } from 'vitest';
import { RecurringEntry } from './models/recurring-entry.model';
import { buildRecurringEntryPayload, RecurringEntryFormValue } from './recurring-entry-payload';

const VALUE: RecurringEntryFormValue = {
  label: 'Loyer',
  amount: 900,
  dayOfMonth: 5,
  date: '',
  endDate: '',
  toAccountId: '',
  category: '',
  memberId: '',
  autoPost: false,
};

function initial(over: Partial<RecurringEntry> = {}): RecurringEntry {
  return {
    id: 'r1',
    memberId: null,
    accountId: 'accSrc',
    toAccountId: null,
    label: 'X',
    amount: 10,
    type: 'expense',
    dayOfMonth: 1,
    date: null,
    endDate: null,
    category: null,
    payslipKey: null,
    autoPost: false,
    autoPostSince: null,
    ...over,
  };
}

describe('buildRecurringEntryPayload', () => {
  it('non-transfer → toAccountId null même si renseigné', () => {
    const p = buildRecurringEntryPayload(
      { ...VALUE, toAccountId: 'acc2' },
      { type: 'expense', initial: null, forcedAccountId: null, currentMonth: '2026-06' },
    );
    expect(p.type).toBe('expense');
    expect(p.toAccountId).toBeNull();
    expect(p.amount).toBe(900);
  });

  it('transfer → toAccountId conservé', () => {
    const p = buildRecurringEntryPayload(
      { ...VALUE, toAccountId: 'acc2' },
      { type: 'transfer', initial: null, forcedAccountId: 'accSrc', currentMonth: '2026-06' },
    );
    expect(p.type).toBe('transfer');
    expect(p.toAccountId).toBe('acc2');
  });

  it('autoPost true sans initial → autoPostSince = currentMonth', () => {
    const p = buildRecurringEntryPayload(
      { ...VALUE, autoPost: true },
      { type: 'expense', initial: null, forcedAccountId: null, currentMonth: '2026-06' },
    );
    expect(p.autoPostSince).toBe('2026-06');
  });

  it('autoPost true avec initial.autoPostSince → conserve la valeur figée', () => {
    const p = buildRecurringEntryPayload(
      { ...VALUE, autoPost: true },
      {
        type: 'expense',
        initial: initial({ autoPostSince: '2025-01' }),
        forcedAccountId: null,
        currentMonth: '2026-06',
      },
    );
    expect(p.autoPostSince).toBe('2025-01');
  });

  it('autoPost false → autoPostSince null', () => {
    const p = buildRecurringEntryPayload(VALUE, {
      type: 'expense',
      initial: initial({ autoPostSince: '2025-01' }),
      forcedAccountId: null,
      currentMonth: '2026-06',
    });
    expect(p.autoPost).toBe(false);
    expect(p.autoPostSince).toBeNull();
  });

  it('accountId = initial.accountId ?? forcedAccountId ?? null', () => {
    const base = { type: 'expense' as const, currentMonth: '2026-06' };
    expect(
      buildRecurringEntryPayload(VALUE, {
        ...base,
        initial: initial({ accountId: 'fromInitial' }),
        forcedAccountId: 'forced',
      }).accountId,
    ).toBe('fromInitial');
    expect(
      buildRecurringEntryPayload(VALUE, { ...base, initial: null, forcedAccountId: 'forced' })
        .accountId,
    ).toBe('forced');
    expect(
      buildRecurringEntryPayload(VALUE, { ...base, initial: null, forcedAccountId: null })
        .accountId,
    ).toBeNull();
  });

  it('strings vides et dayOfMonth 0 → null ; payslipKey repris d’initial', () => {
    const p = buildRecurringEntryPayload(
      { ...VALUE, dayOfMonth: 0, date: '', endDate: '', category: '', memberId: '' },
      {
        type: 'income',
        initial: initial({ payslipKey: 'k1' }),
        forcedAccountId: null,
        currentMonth: '2026-06',
      },
    );
    expect(p.dayOfMonth).toBeNull();
    expect(p.date).toBeNull();
    expect(p.endDate).toBeNull();
    expect(p.category).toBeNull();
    expect(p.memberId).toBeNull();
    expect(p.payslipKey).toBe('k1');
  });
});
