ALTER TABLE "agent"."usage_ledger" ADD COLUMN "credential_source" text NOT NULL DEFAULT 'house';--> statement-breakpoint
UPDATE "agent"."usage_ledger" SET "credential_source" = 'byok-native' WHERE "provider_id" IN ('openai', 'anthropic');--> statement-breakpoint
ALTER TABLE "agent"."usage_ledger" ALTER COLUMN "credential_source" DROP DEFAULT;
