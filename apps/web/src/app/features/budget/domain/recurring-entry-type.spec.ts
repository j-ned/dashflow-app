import { describe, expect, it } from 'vitest';
import { BankAccount } from './models/bank-account.model';
import { RecurringEntry } from './models/recurring-entry.model';
import {
  defaultDestination,
  defaultTransferMode,
  deriveActiveType,
  destinationToggleVisible,
  payslipZoneVisible,
  targetAccountsFor,
  transferModeToggleVisible,
} from './recurring-entry-type';

function account(id: string): BankAccount {
  return { id, name: id, type: 'courant', initialBalance: 0, color: null, dotColor: null };
}

function entry(over: Partial<RecurringEntry> = {}): RecurringEntry {
  return {
    id: 'r1',
    memberId: null,
    accountId: 'accSrc',
    toAccountId: null,
    label: 'X',
    amount: 10,
    type: 'transfer',
    dayOfMonth: null,
    date: null,
    endDate: null,
    category: null,
    payslipKey: null,
    autoPost: false,
    autoPostSince: null,
    ...over,
  };
}

describe('recurring-entry-type', () => {
  it('destinationToggleVisible : expense/transfer → true, autres/null → false', () => {
    expect(destinationToggleVisible('expense')).toBe(true);
    expect(destinationToggleVisible('transfer')).toBe(true);
    expect(destinationToggleVisible('income')).toBe(false);
    expect(destinationToggleVisible(null)).toBe(false);
    expect(destinationToggleVisible(undefined)).toBe(false);
  });

  it('transferModeToggleVisible : transfer uniquement', () => {
    expect(transferModeToggleVisible('transfer')).toBe(true);
    expect(transferModeToggleVisible('expense')).toBe(false);
    expect(transferModeToggleVisible(null)).toBe(false);
  });

  it('payslipZoneVisible : income ET hasInitial', () => {
    expect(payslipZoneVisible('income', true)).toBe(true);
    expect(payslipZoneVisible('income', false)).toBe(false);
    expect(payslipZoneVisible('expense', true)).toBe(false);
  });

  it('defaultDestination : transfer → my_account, sinon third_party (null inclus)', () => {
    expect(defaultDestination('transfer')).toBe('my_account');
    expect(defaultDestination('expense')).toBe('third_party');
    expect(defaultDestination(null)).toBe('third_party');
    expect(defaultDestination(undefined)).toBe('third_party');
  });

  it('deriveActiveType : toggle visible bascule selon destination', () => {
    expect(deriveActiveType({ baseType: 'expense', destination: 'my_account' })).toBe('transfer');
    expect(deriveActiveType({ baseType: 'expense', destination: 'third_party' })).toBe('expense');
    expect(deriveActiveType({ baseType: 'transfer', destination: 'third_party' })).toBe('expense');
  });

  it('deriveActiveType : toggle masqué → baseType ?? expense', () => {
    expect(deriveActiveType({ baseType: 'income', destination: 'third_party' })).toBe('income');
    expect(deriveActiveType({ baseType: 'spending', destination: 'my_account' })).toBe('spending');
    expect(deriveActiveType({ baseType: null, destination: 'third_party' })).toBe('expense');
  });

  it('defaultTransferMode : initial transfer avec dayOfMonth → recurring, sans → one_time', () => {
    expect(defaultTransferMode(entry({ type: 'transfer', dayOfMonth: 5 }), 'one_time')).toBe(
      'recurring',
    );
    expect(defaultTransferMode(entry({ type: 'transfer', dayOfMonth: null }), 'recurring')).toBe(
      'one_time',
    );
  });

  it('defaultTransferMode : sinon le fallback', () => {
    expect(defaultTransferMode(null, 'recurring')).toBe('recurring');
    expect(defaultTransferMode(entry({ type: 'expense' }), 'one_time')).toBe('one_time');
  });

  it('targetAccountsFor : exclut le compte source', () => {
    const accts = [account('a1'), account('a2'), account('a3')];
    expect(targetAccountsFor(accts, 'a2').map((a) => a.id)).toEqual(['a1', 'a3']);
    expect(targetAccountsFor(accts, null).map((a) => a.id)).toEqual(['a1', 'a2', 'a3']);
  });
});
