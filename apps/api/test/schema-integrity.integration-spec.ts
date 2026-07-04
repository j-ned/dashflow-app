import { describe, it, expect, afterAll } from 'vitest';
import postgres from 'postgres';

// DATABASE_URL is injected via vitest.integration.config.ts → test.env
const sql = postgres(process.env.DATABASE_URL!);

const EXPECTED_TABLES = [
  'users',
  'verification_codes',
  'bank_accounts',
  'envelopes',
  'envelope_transactions',
  'loans',
  'loan_transactions',
  'consumables',
  'recurring_entries',
  'salary_archives',
  'patients',
  'practitioners',
  'appointments',
  'prescriptions',
  'medications',
  'documents',
  'reminders',
  'shared_access',
];

describe('intégrité schéma porté ↔ DB locale', () => {
  afterAll(async () => {
    await sql.end();
  });

  it('toutes les tables attendues existent dans le schéma public', async () => {
    const rows = await sql<{ table_name: string }[]>`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'`;
    const present = new Set(rows.map((r) => r.table_name));
    for (const t of EXPECTED_TABLES)
      expect(present.has(t), `table ${t}`).toBe(true);
  });

  it('users a les colonnes E2EE clés', async () => {
    const rows = await sql<{ column_name: string }[]>`
      SELECT column_name FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'users'`;
    const cols = new Set(rows.map((r) => r.column_name));
    for (const c of [
      'encryption_salt',
      'wrapped_master_key',
      'recovery_wrapped_key',
      'encryption_version',
      'encryption_passphrase',
      'totp_secret',
      'totp_enabled',
    ]) {
      expect(cols.has(c), `colonne users.${c}`).toBe(true);
    }
  });
});
