ALTER TABLE "medications" ADD CONSTRAINT "medications_daily_rate_positive" CHECK ("medications"."daily_rate" > 0);--> statement-breakpoint
ALTER TABLE "account_transactions" ADD CONSTRAINT "account_transactions_amount_nonneg" CHECK ("account_transactions"."amount" >= 0);--> statement-breakpoint
ALTER TABLE "envelopes" ADD CONSTRAINT "envelopes_target_nonneg" CHECK ("envelopes"."target" is null or "envelopes"."target" >= 0);--> statement-breakpoint
ALTER TABLE "loan_transactions" ADD CONSTRAINT "loan_transactions_amount_nonneg" CHECK ("loan_transactions"."amount" >= 0);--> statement-breakpoint
ALTER TABLE "loans" ADD CONSTRAINT "loans_amount_nonneg" CHECK ("loans"."amount" >= 0);--> statement-breakpoint
ALTER TABLE "loans" ADD CONSTRAINT "loans_remaining_nonneg" CHECK ("loans"."remaining" >= 0);--> statement-breakpoint
ALTER TABLE "loans" ADD CONSTRAINT "loans_remaining_lte_amount" CHECK ("loans"."remaining" <= "loans"."amount");--> statement-breakpoint
ALTER TABLE "recurring_entries" ADD CONSTRAINT "recurring_entries_amount_nonneg" CHECK ("recurring_entries"."amount" >= 0);--> statement-breakpoint
ALTER TABLE "salary_archives" ADD CONSTRAINT "salary_archives_salary_nonneg" CHECK ("salary_archives"."salary" >= 0);--> statement-breakpoint
ALTER TABLE "salary_archives" ADD CONSTRAINT "salary_archives_total_expenses_nonneg" CHECK ("salary_archives"."total_expenses" >= 0);--> statement-breakpoint
ALTER TABLE "salary_archives" ADD CONSTRAINT "salary_archives_total_spendings_nonneg" CHECK ("salary_archives"."total_spendings" >= 0);