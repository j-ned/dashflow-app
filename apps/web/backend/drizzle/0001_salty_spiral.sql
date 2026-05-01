ALTER TYPE "public"."recurring_entry_type" ADD VALUE 'transfer';--> statement-breakpoint
ALTER TABLE "recurring_entries" ADD COLUMN "end_date" date;--> statement-breakpoint
ALTER TABLE "recurring_entries" ADD COLUMN "to_account_id" uuid;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "is_demo_account" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "recurring_entries" ADD CONSTRAINT "recurring_entries_to_account_id_bank_accounts_id_fk" FOREIGN KEY ("to_account_id") REFERENCES "public"."bank_accounts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "users_is_demo_account_idx" ON "users" ("is_demo_account") WHERE "is_demo_account" = true;