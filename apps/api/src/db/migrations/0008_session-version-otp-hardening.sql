ALTER TABLE "verification_codes" ALTER COLUMN "code" SET DATA TYPE varchar(64);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "session_version" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "totp_last_used_step" integer;--> statement-breakpoint
ALTER TABLE "verification_codes" ADD COLUMN "attempts" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
-- Les codes existants sont stockés en clair (6 chiffres) : incompatibles avec la comparaison
-- par hash. Ils expirent en 10 min de toute façon ; on les purge.
DELETE FROM "verification_codes";
