DROP TABLE "chia_account" CASCADE;--> statement-breakpoint
DROP TABLE "chia_session" CASCADE;--> statement-breakpoint
DROP TABLE "chia_verificationToken" CASCADE;--> statement-breakpoint
ALTER TABLE "chia_user" ADD COLUMN "email_verified" boolean;--> statement-breakpoint
ALTER TABLE "chia_user" DROP COLUMN "emailVerified";