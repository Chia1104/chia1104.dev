CREATE TABLE "agent"."usage_ledger" (
	"id" bigserial PRIMARY KEY,
	"user_id" text NOT NULL,
	"session_id" text,
	"run_id" text,
	"entry_id" text,
	"kind" text NOT NULL,
	"source" text NOT NULL,
	"provider_id" text NOT NULL,
	"model_id" text NOT NULL,
	"input" integer NOT NULL,
	"output" integer NOT NULL,
	"cache_read" integer NOT NULL,
	"cache_write" integer NOT NULL,
	"reasoning" integer,
	"cost_micros" bigint NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "agent_usage_ledger_user_created_idx" ON "agent"."usage_ledger" ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "agent_usage_ledger_session_id_idx" ON "agent"."usage_ledger" ("session_id");--> statement-breakpoint
ALTER TABLE "agent"."usage_ledger" ADD CONSTRAINT "usage_ledger_user_id_chia_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "chia_user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "agent"."usage_ledger" ADD CONSTRAINT "usage_ledger_session_id_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "agent"."session"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "agent"."usage_ledger" ADD CONSTRAINT "usage_ledger_run_id_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "agent"."run"("id") ON DELETE SET NULL;