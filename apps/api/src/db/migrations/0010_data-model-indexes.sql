-- Index sur toutes les FK et clés de filtrage (jusqu'ici : seq-scan partout hors PK/unique), et
-- contraintes métier. Les CHECK sont posés NOT VALID : ils s'appliquent aux lignes nouvelles ou
-- modifiées sans faire échouer la migration si une ligne historique les viole. Après contrôle
-- des données (SELECT ... WHERE NOT (<condition>)), les valider :
--   ALTER TABLE <table> VALIDATE CONSTRAINT <nom>;
CREATE INDEX "verification_codes_email_purpose_idx" ON "verification_codes" USING btree ("email","purpose");--> statement-breakpoint
CREATE INDEX "appointments_user_created_idx" ON "appointments" USING btree ("user_id","created_at","id");--> statement-breakpoint
CREATE INDEX "appointments_patient_idx" ON "appointments" USING btree ("patient_id");--> statement-breakpoint
CREATE INDEX "appointments_practitioner_idx" ON "appointments" USING btree ("practitioner_id");--> statement-breakpoint
CREATE INDEX "documents_user_created_idx" ON "documents" USING btree ("user_id","created_at","id");--> statement-breakpoint
CREATE INDEX "documents_patient_idx" ON "documents" USING btree ("patient_id");--> statement-breakpoint
CREATE INDEX "documents_practitioner_idx" ON "documents" USING btree ("practitioner_id");--> statement-breakpoint
CREATE INDEX "medications_user_created_idx" ON "medications" USING btree ("user_id","created_at","id");--> statement-breakpoint
CREATE INDEX "medications_patient_idx" ON "medications" USING btree ("patient_id");--> statement-breakpoint
CREATE INDEX "medications_prescription_idx" ON "medications" USING btree ("prescription_id");--> statement-breakpoint
CREATE INDEX "patients_user_created_idx" ON "patients" USING btree ("user_id","created_at","id");--> statement-breakpoint
CREATE INDEX "practitioners_user_created_idx" ON "practitioners" USING btree ("user_id","created_at","id");--> statement-breakpoint
CREATE INDEX "prescriptions_user_created_idx" ON "prescriptions" USING btree ("user_id","created_at","id");--> statement-breakpoint
CREATE INDEX "prescriptions_patient_idx" ON "prescriptions" USING btree ("patient_id");--> statement-breakpoint
CREATE INDEX "prescriptions_appointment_idx" ON "prescriptions" USING btree ("appointment_id");--> statement-breakpoint
CREATE INDEX "prescriptions_practitioner_idx" ON "prescriptions" USING btree ("practitioner_id");--> statement-breakpoint
CREATE INDEX "reminders_user_created_idx" ON "reminders" USING btree ("user_id","created_at","id");--> statement-breakpoint
CREATE INDEX "reminders_medication_idx" ON "reminders" USING btree ("medication_id");--> statement-breakpoint
CREATE INDEX "reminders_appointment_idx" ON "reminders" USING btree ("appointment_id");--> statement-breakpoint
CREATE INDEX "account_transactions_user_created_idx" ON "account_transactions" USING btree ("user_id","created_at","id");--> statement-breakpoint
CREATE INDEX "account_transactions_account_created_idx" ON "account_transactions" USING btree ("account_id","created_at","id");--> statement-breakpoint
CREATE INDEX "account_transactions_to_account_idx" ON "account_transactions" USING btree ("to_account_id");--> statement-breakpoint
CREATE INDEX "account_transactions_member_idx" ON "account_transactions" USING btree ("member_id");--> statement-breakpoint
CREATE INDEX "account_transactions_recurring_idx" ON "account_transactions" USING btree ("recurring_entry_id");--> statement-breakpoint
CREATE INDEX "bank_accounts_user_created_idx" ON "bank_accounts" USING btree ("user_id","created_at","id");--> statement-breakpoint
CREATE INDEX "consumables_user_idx" ON "consumables" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "consumables_member_idx" ON "consumables" USING btree ("member_id");--> statement-breakpoint
CREATE INDEX "envelope_transactions_envelope_created_idx" ON "envelope_transactions" USING btree ("envelope_id","created_at","id");--> statement-breakpoint
CREATE INDEX "envelopes_user_idx" ON "envelopes" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "envelopes_member_idx" ON "envelopes" USING btree ("member_id");--> statement-breakpoint
CREATE INDEX "loan_transactions_loan_created_idx" ON "loan_transactions" USING btree ("loan_id","created_at","id");--> statement-breakpoint
CREATE INDEX "loans_user_idx" ON "loans" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "loans_member_idx" ON "loans" USING btree ("member_id");--> statement-breakpoint
CREATE INDEX "recurring_entries_user_created_idx" ON "recurring_entries" USING btree ("user_id","created_at","id");--> statement-breakpoint
CREATE INDEX "recurring_entries_member_idx" ON "recurring_entries" USING btree ("member_id");--> statement-breakpoint
CREATE INDEX "recurring_entries_account_idx" ON "recurring_entries" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "recurring_entries_to_account_idx" ON "recurring_entries" USING btree ("to_account_id");--> statement-breakpoint
CREATE INDEX "salary_archives_user_month_idx" ON "salary_archives" USING btree ("user_id","month","id");--> statement-breakpoint
CREATE INDEX "salary_archives_account_idx" ON "salary_archives" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "shared_access_user_idx" ON "shared_access" USING btree ("user_id");--> statement-breakpoint
ALTER TABLE "reminders" ADD CONSTRAINT "reminders_target_has_ref" CHECK (("reminders"."target" = 'medication' and "reminders"."medication_id" is not null) or ("reminders"."target" = 'appointment' and "reminders"."appointment_id" is not null)) NOT VALID;--> statement-breakpoint
ALTER TABLE "account_transactions" ADD CONSTRAINT "account_transactions_no_self_transfer" CHECK ("account_transactions"."to_account_id" is null or "account_transactions"."to_account_id" <> "account_transactions"."account_id") NOT VALID;--> statement-breakpoint
ALTER TABLE "envelopes" ADD CONSTRAINT "envelopes_due_day_range" CHECK ("envelopes"."due_day" is null or ("envelopes"."due_day" between 1 and 31)) NOT VALID;--> statement-breakpoint
ALTER TABLE "loans" ADD CONSTRAINT "loans_due_day_range" CHECK ("loans"."due_day" is null or ("loans"."due_day" between 1 and 31)) NOT VALID;--> statement-breakpoint
ALTER TABLE "loans" ADD CONSTRAINT "loans_due_date_after_date" CHECK ("loans"."due_date" is null or "loans"."due_date" >= "loans"."date") NOT VALID;--> statement-breakpoint
ALTER TABLE "recurring_entries" ADD CONSTRAINT "recurring_entries_day_of_month_range" CHECK ("recurring_entries"."day_of_month" is null or ("recurring_entries"."day_of_month" between 1 and 31)) NOT VALID;--> statement-breakpoint
ALTER TABLE "recurring_entries" ADD CONSTRAINT "recurring_entries_end_after_start" CHECK ("recurring_entries"."end_date" is null or "recurring_entries"."date" is null or "recurring_entries"."end_date" >= "recurring_entries"."date") NOT VALID;--> statement-breakpoint
ALTER TABLE "recurring_entries" ADD CONSTRAINT "recurring_entries_no_self_transfer" CHECK ("recurring_entries"."to_account_id" is null or "recurring_entries"."account_id" is null or "recurring_entries"."to_account_id" <> "recurring_entries"."account_id") NOT VALID;