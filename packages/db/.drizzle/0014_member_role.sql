ALTER TABLE "chia_invitation" ALTER COLUMN "role" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "chia_invitation" ALTER COLUMN "role" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "chia_member" ALTER COLUMN "role" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "chia_member" ALTER COLUMN "role" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "chia_member" ALTER COLUMN "role" DROP NOT NULL;