CREATE TABLE "agent"."prompt_screen" (
	"id" bigserial PRIMARY KEY,
	"user_id" text NOT NULL,
	"session_id" text NOT NULL,
	"kind" text NOT NULL,
	"verdict" text NOT NULL,
	"reason" text,
	"signals" jsonb NOT NULL,
	"text_hash" text NOT NULL,
	"text_length" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "prompt_screen_user_created_idx" ON "agent"."prompt_screen" ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "prompt_screen_verdict_created_idx" ON "agent"."prompt_screen" ("verdict","created_at");--> statement-breakpoint
ALTER TABLE "agent"."prompt_screen" ADD CONSTRAINT "prompt_screen_user_id_chia_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "chia_user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "agent"."prompt_screen" ADD CONSTRAINT "prompt_screen_session_id_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "agent"."session"("id") ON DELETE CASCADE;