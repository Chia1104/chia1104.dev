ALTER TABLE "agent"."memory" ADD COLUMN "supersedes_id" integer;--> statement-breakpoint
ALTER TABLE "agent"."memory" ADD COLUMN "reinforcements" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "agent"."writing_session" ADD COLUMN "consolidated_leaf_id" text;--> statement-breakpoint
ALTER TABLE "agent"."writing_session" ADD COLUMN "consolidated_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "agent"."writing_session" ADD COLUMN "consolidation_run_id" text;--> statement-breakpoint
ALTER TABLE "agent"."memory" ADD CONSTRAINT "memory_supersedes_id_memory_id_fkey" FOREIGN KEY ("supersedes_id") REFERENCES "agent"."memory"("id") ON DELETE SET NULL;