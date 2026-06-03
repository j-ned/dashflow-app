import { describe, it, expect } from 'vitest';
import * as schema from './index';
import { getTableName } from 'drizzle-orm';

const EXPECTED_TABLES = [
  'users', 'verification_codes',
  'bank_accounts', 'account_transactions', 'envelopes', 'envelope_transactions', 'loans',
  'loan_transactions', 'consumables', 'recurring_entries', 'salary_archives',
  'patients', 'practitioners', 'appointments', 'prescriptions', 'medications',
  'documents', 'reminders', 'shared_access',
];

describe('schéma Drizzle porté', () => {
  it('exporte exactement les 19 tables attendues', () => {
    const tables = Object.values(schema).filter((v) => {
      try { return getTableName(v as never) !== undefined; } catch { return false; }
    });
    const names = tables.map((t) => getTableName(t as never));
    expect(new Set(names)).toEqual(new Set(EXPECTED_TABLES));
    expect(names).toHaveLength(19);
  });
});
