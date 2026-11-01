-- Snapshot de la démo (créé hors drizzle par scripts/demo-seed-snapshot.sql) : plus restauré.
-- À supprimer AVANT le type : sa colonne "category" dépend de "consumable_category".
DROP TABLE IF EXISTS "demo_seed_consumables";--> statement-breakpoint
DROP TABLE "consumables" CASCADE;--> statement-breakpoint
DROP TYPE "public"."consumable_category";
