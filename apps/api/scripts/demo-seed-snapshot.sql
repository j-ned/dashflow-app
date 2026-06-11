-- Régénère les snapshots demo_seed_* à partir de l'état ACTUEL du compte démo.
-- Ces tables sont la source de vérité du reset démo (DemoService.reset) — elles n'étaient
-- créées par AUCUN script (faites main, puis perdues → reset cassé « relation does not exist »).
-- À rejouer après toute évolution volontaire des données de démonstration.
--
-- Usage (prod, depuis le homeserver) :
--   docker exec -i $(docker ps -qf name=dashflow-database) \
--     psql -U djoudj -d dashflow_db -v ON_ERROR_STOP=1 < scripts/demo-seed-snapshot.sql
--
-- Idempotent (DROP ... IF EXISTS) et atomique (transaction).

BEGIN;

-- Hygiène : retire d'éventuelles entrées de test polluant le démo.
DELETE FROM recurring_entries
 WHERE user_id = (SELECT id FROM users WHERE is_demo_account LIMIT 1)
   AND label = 'TEST virement Livret';

-- ── Tables scopées par user_id ───────────────────────────────────────────────
DROP TABLE IF EXISTS demo_seed_shared_access;
CREATE TABLE demo_seed_shared_access      AS SELECT * FROM shared_access      WHERE user_id = (SELECT id FROM users WHERE is_demo_account LIMIT 1);
DROP TABLE IF EXISTS demo_seed_patients;
CREATE TABLE demo_seed_patients           AS SELECT * FROM patients           WHERE user_id = (SELECT id FROM users WHERE is_demo_account LIMIT 1);
DROP TABLE IF EXISTS demo_seed_practitioners;
CREATE TABLE demo_seed_practitioners      AS SELECT * FROM practitioners      WHERE user_id = (SELECT id FROM users WHERE is_demo_account LIMIT 1);
DROP TABLE IF EXISTS demo_seed_bank_accounts;
CREATE TABLE demo_seed_bank_accounts      AS SELECT * FROM bank_accounts      WHERE user_id = (SELECT id FROM users WHERE is_demo_account LIMIT 1);
DROP TABLE IF EXISTS demo_seed_appointments;
CREATE TABLE demo_seed_appointments       AS SELECT * FROM appointments       WHERE user_id = (SELECT id FROM users WHERE is_demo_account LIMIT 1);
DROP TABLE IF EXISTS demo_seed_envelopes;
CREATE TABLE demo_seed_envelopes          AS SELECT * FROM envelopes          WHERE user_id = (SELECT id FROM users WHERE is_demo_account LIMIT 1);
DROP TABLE IF EXISTS demo_seed_loans;
CREATE TABLE demo_seed_loans              AS SELECT * FROM loans              WHERE user_id = (SELECT id FROM users WHERE is_demo_account LIMIT 1);
DROP TABLE IF EXISTS demo_seed_salary_archives;
CREATE TABLE demo_seed_salary_archives    AS SELECT * FROM salary_archives    WHERE user_id = (SELECT id FROM users WHERE is_demo_account LIMIT 1);
DROP TABLE IF EXISTS demo_seed_prescriptions;
CREATE TABLE demo_seed_prescriptions      AS SELECT * FROM prescriptions      WHERE user_id = (SELECT id FROM users WHERE is_demo_account LIMIT 1);
DROP TABLE IF EXISTS demo_seed_medications;
CREATE TABLE demo_seed_medications        AS SELECT * FROM medications        WHERE user_id = (SELECT id FROM users WHERE is_demo_account LIMIT 1);
DROP TABLE IF EXISTS demo_seed_documents;
CREATE TABLE demo_seed_documents          AS SELECT * FROM documents          WHERE user_id = (SELECT id FROM users WHERE is_demo_account LIMIT 1);
DROP TABLE IF EXISTS demo_seed_consumables;
CREATE TABLE demo_seed_consumables        AS SELECT * FROM consumables        WHERE user_id = (SELECT id FROM users WHERE is_demo_account LIMIT 1);
DROP TABLE IF EXISTS demo_seed_recurring_entries;
CREATE TABLE demo_seed_recurring_entries  AS SELECT * FROM recurring_entries  WHERE user_id = (SELECT id FROM users WHERE is_demo_account LIMIT 1);
DROP TABLE IF EXISTS demo_seed_account_transactions;
CREATE TABLE demo_seed_account_transactions AS SELECT * FROM account_transactions WHERE user_id = (SELECT id FROM users WHERE is_demo_account LIMIT 1);
DROP TABLE IF EXISTS demo_seed_reminders;
CREATE TABLE demo_seed_reminders          AS SELECT * FROM reminders          WHERE user_id = (SELECT id FROM users WHERE is_demo_account LIMIT 1);

-- ── Tables enfants sans user_id (scopées via leur parent) ────────────────────
DROP TABLE IF EXISTS demo_seed_envelope_transactions;
CREATE TABLE demo_seed_envelope_transactions AS
  SELECT * FROM envelope_transactions
   WHERE envelope_id IN (SELECT id FROM envelopes WHERE user_id = (SELECT id FROM users WHERE is_demo_account LIMIT 1));
DROP TABLE IF EXISTS demo_seed_loan_transactions;
CREATE TABLE demo_seed_loan_transactions AS
  SELECT * FROM loan_transactions
   WHERE loan_id IN (SELECT id FROM loans WHERE user_id = (SELECT id FROM users WHERE is_demo_account LIMIT 1));

COMMIT;
