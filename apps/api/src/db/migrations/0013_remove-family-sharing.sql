DROP TABLE "shared_access" CASCADE;--> statement-breakpoint
-- Snapshot de la démo (créé hors drizzle par scripts/demo-seed-snapshot.sql) : plus restauré.
DROP TABLE IF EXISTS "demo_seed_shared_access";
