ALTER TABLE "chia_account" ADD COLUMN "issuer" text;--> statement-breakpoint
UPDATE "chia_account"
SET
	"issuer" = CASE
		WHEN "provider_id" = 'credential' THEN 'local:credential'
		WHEN "provider_id" = 'github' THEN 'local:oauth:github'
		WHEN "provider_id" = 'google' THEN 'https://accounts.google.com'
	END,
	"account_id" = CASE
		WHEN "provider_id" = 'credential' THEN "user_id"
		ELSE "account_id"
	END;--> statement-breakpoint
ALTER TABLE "chia_account" ALTER COLUMN "issuer" SET NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "account_issuer_account_id_uidx" ON "chia_account" ("issuer","account_id");