-- Snapshot de la démo (créé hors drizzle par scripts/demo-seed-snapshot.sql) : sa colonne "type"
-- dépend de "reminder_type", à retirer AVANT le type. La restauration ne copie que les colonnes communes.
ALTER TABLE IF EXISTS "demo_seed_reminders" DROP COLUMN IF EXISTS "type", DROP COLUMN IF EXISTS "recipient_email";--> statement-breakpoint
ALTER TABLE "reminders" DROP COLUMN "type";--> statement-breakpoint
ALTER TABLE "reminders" DROP COLUMN "recipient_email";--> statement-breakpoint
DROP TYPE "public"."reminder_type";
