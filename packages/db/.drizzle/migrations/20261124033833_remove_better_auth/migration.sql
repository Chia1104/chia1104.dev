DELETE FROM "chia_session";--> statement-breakpoint
DELETE FROM "chia_user" WHERE "is_anonymous" IS TRUE;--> statement-breakpoint
DROP TABLE "chia_passkey";--> statement-breakpoint
DROP TABLE "chia_verification";--> statement-breakpoint
ALTER TABLE "chia_apikey" RENAME COLUMN "key" TO "key_hash";--> statement-breakpoint
ALTER TABLE "chia_apikey" RENAME COLUMN "reference_id" TO "user_id";--> statement-breakpoint
ALTER TABLE "chia_apikey" RENAME COLUMN "last_request" TO "last_used_at";--> statement-breakpoint
ALTER TABLE "chia_session" DROP CONSTRAINT "chia_session_token_unique";--> statement-breakpoint
DROP INDEX "apikey_key_idx";--> statement-breakpoint
DROP INDEX "apikey_configId_idx";--> statement-breakpoint
DROP INDEX "apikey_referenceId_idx";--> statement-breakpoint
ALTER TABLE "chia_apikey" ADD COLUMN "scopes" text[] DEFAULT '{}'::text[] NOT NULL;--> statement-breakpoint
UPDATE "chia_apikey" SET "scopes" = ARRAY(SELECT "resource" || ':' || "action" FROM jsonb_each("permissions"::jsonb) AS "entry"("resource", "actions"), jsonb_array_elements_text("entry"."actions") AS "action") WHERE "permissions" IS NOT NULL;--> statement-breakpoint
ALTER TABLE "chia_apikey" ALTER COLUMN "scopes" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "chia_session" ADD COLUMN "token_hash" text NOT NULL;--> statement-breakpoint
ALTER TABLE "chia_apikey" DROP COLUMN "prefix";--> statement-breakpoint
ALTER TABLE "chia_apikey" DROP COLUMN "refill_interval";--> statement-breakpoint
ALTER TABLE "chia_apikey" DROP COLUMN "refill_amount";--> statement-breakpoint
ALTER TABLE "chia_apikey" DROP COLUMN "last_refill_at";--> statement-breakpoint
ALTER TABLE "chia_apikey" DROP COLUMN "rate_limit_enabled";--> statement-breakpoint
ALTER TABLE "chia_apikey" DROP COLUMN "rate_limit_time_window";--> statement-breakpoint
ALTER TABLE "chia_apikey" DROP COLUMN "rate_limit_max";--> statement-breakpoint
ALTER TABLE "chia_apikey" DROP COLUMN "request_count";--> statement-breakpoint
ALTER TABLE "chia_apikey" DROP COLUMN "remaining";--> statement-breakpoint
ALTER TABLE "chia_apikey" DROP COLUMN "permissions";--> statement-breakpoint
ALTER TABLE "chia_apikey" DROP COLUMN "metadata";--> statement-breakpoint
ALTER TABLE "chia_apikey" DROP COLUMN "config_id";--> statement-breakpoint
ALTER TABLE "chia_session" DROP COLUMN "token";--> statement-breakpoint
ALTER TABLE "chia_session" DROP COLUMN "impersonated_by";--> statement-breakpoint
ALTER TABLE "chia_account" DROP COLUMN "access_token";--> statement-breakpoint
ALTER TABLE "chia_account" DROP COLUMN "refresh_token";--> statement-breakpoint
ALTER TABLE "chia_account" DROP COLUMN "id_token";--> statement-breakpoint
ALTER TABLE "chia_account" DROP COLUMN "access_token_expires_at";--> statement-breakpoint
ALTER TABLE "chia_account" DROP COLUMN "refresh_token_expires_at";--> statement-breakpoint
ALTER TABLE "chia_account" DROP COLUMN "scope";--> statement-breakpoint
ALTER TABLE "chia_account" DROP COLUMN "password";--> statement-breakpoint
ALTER TABLE "chia_user" DROP COLUMN "email_verified";--> statement-breakpoint
ALTER TABLE "chia_user" DROP COLUMN "role";--> statement-breakpoint
UPDATE "chia_apikey" SET "enabled" = true WHERE "enabled" IS NULL;--> statement-breakpoint
ALTER TABLE "chia_apikey" ALTER COLUMN "enabled" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "chia_user" ALTER COLUMN "email" DROP NOT NULL;--> statement-breakpoint
UPDATE "chia_user" SET "is_anonymous" = false WHERE "is_anonymous" IS NULL;--> statement-breakpoint
ALTER TABLE "chia_user" ALTER COLUMN "is_anonymous" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "chia_apikey" ADD CONSTRAINT "chia_apikey_key_hash_key" UNIQUE("key_hash");--> statement-breakpoint
ALTER TABLE "chia_session" ADD CONSTRAINT "chia_session_token_hash_key" UNIQUE("token_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "account_provider_account_idx" ON "chia_account" ("provider_id","account_id");--> statement-breakpoint
CREATE INDEX "apikey_user_id_idx" ON "chia_apikey" ("user_id");--> statement-breakpoint
DELETE FROM "chia_apikey" WHERE "user_id" NOT IN (SELECT "id" FROM "chia_user");--> statement-breakpoint
ALTER TABLE "chia_apikey" ADD CONSTRAINT "chia_apikey_user_id_chia_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "chia_user"("id") ON DELETE CASCADE;--> statement-breakpoint
DROP TYPE "role";