ALTER TYPE "public"."role" ADD VALUE 'root';--> statement-breakpoint
ALTER TABLE "chia_passkey" DROP CONSTRAINT "chia_passkey_user_id_chia_user_id_fk";
--> statement-breakpoint
ALTER TABLE "chia_user" ADD COLUMN "banned" boolean;--> statement-breakpoint
ALTER TABLE "chia_user" ADD COLUMN "ban_reason" text;--> statement-breakpoint
ALTER TABLE "chia_user" ADD COLUMN "ban_expires" timestamp;--> statement-breakpoint
ALTER TABLE "chia_passkey" ADD CONSTRAINT "chia_passkey_user_id_chia_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."chia_user"("id") ON DELETE cascade ON UPDATE no action;