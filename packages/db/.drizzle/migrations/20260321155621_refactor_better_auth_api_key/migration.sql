ALTER TABLE "chia_apikey" DROP CONSTRAINT "chia_apikey_user_id_chia_user_id_fk";--> statement-breakpoint
ALTER TABLE "chia_apikey" RENAME COLUMN "user_id" TO "reference_id";--> statement-breakpoint
ALTER INDEX "apikey_user_id_idx" RENAME TO "apikey_referenceId_idx";--> statement-breakpoint
ALTER TABLE "chia_apikey" ADD COLUMN "config_id" text DEFAULT 'default' NOT NULL;--> statement-breakpoint
CREATE INDEX "apikey_configId_idx" ON "chia_apikey" ("config_id");