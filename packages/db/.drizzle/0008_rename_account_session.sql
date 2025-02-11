ALTER TABLE "chia_better_account" RENAME TO "chia_account";--> statement-breakpoint
ALTER TABLE "chia_better_session" RENAME TO "chia_session";--> statement-breakpoint
ALTER TABLE "chia_session" DROP CONSTRAINT "chia_better_session_token_unique";--> statement-breakpoint
ALTER TABLE "chia_account" DROP CONSTRAINT "chia_better_account_user_id_chia_user_id_fk";
--> statement-breakpoint
ALTER TABLE "chia_session" DROP CONSTRAINT "chia_better_session_user_id_chia_user_id_fk";
--> statement-breakpoint
ALTER TABLE "chia_account" ADD CONSTRAINT "chia_account_user_id_chia_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."chia_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chia_session" ADD CONSTRAINT "chia_session_user_id_chia_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."chia_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chia_session" ADD CONSTRAINT "chia_session_token_unique" UNIQUE("token");