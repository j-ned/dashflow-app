CREATE TYPE "public"."transaction_direction" AS ENUM('income', 'expense', 'transfer');--> statement-breakpoint
CREATE TABLE "account_transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"account_id" uuid NOT NULL,
	"amount" numeric(12, 2) DEFAULT '0' NOT NULL,
	"direction" "transaction_direction" DEFAULT 'expense' NOT NULL,
	"to_account_id" uuid,
	"date" date NOT NULL,
	"category" varchar(100),
	"note" varchar(255),
	"member_id" uuid,
	"recurring_entry_id" uuid,
	"encrypted_data" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "account_transactions" ADD CONSTRAINT "account_transactions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account_transactions" ADD CONSTRAINT "account_transactions_account_id_bank_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."bank_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account_transactions" ADD CONSTRAINT "account_transactions_to_account_id_bank_accounts_id_fk" FOREIGN KEY ("to_account_id") REFERENCES "public"."bank_accounts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account_transactions" ADD CONSTRAINT "account_transactions_member_id_patients_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."patients"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account_transactions" ADD CONSTRAINT "account_transactions_recurring_entry_id_recurring_entries_id_fk" FOREIGN KEY ("recurring_entry_id") REFERENCES "public"."recurring_entries"("id") ON DELETE set null ON UPDATE no action;