ALTER TABLE "agent"."session" ADD COLUMN "forked_from_session_id" text;--> statement-breakpoint
ALTER TABLE "agent"."session" ADD COLUMN "forked_from_entry_id" text;--> statement-breakpoint
ALTER TABLE "agent"."session" ADD CONSTRAINT "session_forked_from_session_id_session_id_fkey" FOREIGN KEY ("forked_from_session_id") REFERENCES "agent"."session"("id") ON DELETE SET NULL;