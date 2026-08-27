-- Hand-written. drizzle-kit's output for this change re-adds the two generated columns
-- without NOT NULL and emits two of the indexes twice; Postgres cannot alter a generated
-- expression in place, so the columns are dropped and re-added, and every index that
-- referenced them is rebuilt afterwards.
CREATE TABLE "agent"."memory" (
	"id" serial PRIMARY KEY,
	"kind" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"title" text NOT NULL,
	"content" text NOT NULL,
	"source_url" text,
	"session_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp
);
--> statement-breakpoint
CREATE UNIQUE INDEX "agent_memory_source_url_idx" ON "agent"."memory" ("source_url") WHERE "kind" = 'source' and "deleted_at" is null;--> statement-breakpoint
CREATE INDEX "agent_memory_session_id_idx" ON "agent"."memory" ("session_id");--> statement-breakpoint
CREATE INDEX "agent_memory_kind_status_idx" ON "agent"."memory" ("kind","status");--> statement-breakpoint
ALTER TABLE "agent"."memory" ADD CONSTRAINT "memory_session_id_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "agent"."session"("id") ON DELETE SET NULL;--> statement-breakpoint
-- `DROP COLUMN` would drop these on its own; dropping them first keeps the order explicit.
DROP INDEX "resource_chunk_bm25_idx";--> statement-breakpoint
DROP INDEX "resource_chunk_source_kind_index_idx";--> statement-breakpoint
DROP INDEX "resource_chunk_source_idx";--> statement-breakpoint
ALTER TABLE "chia_resource_chunk" DROP CONSTRAINT "resource_chunk_single_source";--> statement-breakpoint
ALTER TABLE "chia_resource_chunk" DROP COLUMN "source_type";--> statement-breakpoint
ALTER TABLE "chia_resource_chunk" DROP COLUMN "source_id";--> statement-breakpoint
ALTER TABLE "chia_resource_chunk" ADD COLUMN "agent_memory_id" integer;--> statement-breakpoint
ALTER TABLE "chia_resource_chunk" ADD CONSTRAINT "chia_resource_chunk_agent_memory_id_memory_id_fkey" FOREIGN KEY ("agent_memory_id") REFERENCES "agent"."memory"("id") ON DELETE CASCADE;--> statement-breakpoint
-- STORED back-fills existing rows; every one of them has `feed_translation_id` set, so NOT NULL holds.
ALTER TABLE "chia_resource_chunk" ADD COLUMN "source_type" text GENERATED ALWAYS AS (case when "feed_translation_id" is not null then 'feed_translation' when "agent_memory_id" is not null then 'agent_memory' end) STORED NOT NULL;--> statement-breakpoint
ALTER TABLE "chia_resource_chunk" ADD COLUMN "source_id" integer GENERATED ALWAYS AS (coalesce("feed_translation_id", "agent_memory_id")) STORED NOT NULL;--> statement-breakpoint
ALTER TABLE "chia_resource_chunk" ADD CONSTRAINT "resource_chunk_single_source" CHECK (num_nonnulls("feed_translation_id", "agent_memory_id") = 1);--> statement-breakpoint
CREATE UNIQUE INDEX "resource_chunk_source_kind_index_idx" ON "chia_resource_chunk" ("source_type","source_id","kind","chunk_index");--> statement-breakpoint
CREATE INDEX "resource_chunk_source_idx" ON "chia_resource_chunk" ("source_type","source_id");--> statement-breakpoint
CREATE INDEX "resource_chunk_agent_memory_id_idx" ON "chia_resource_chunk" ("agent_memory_id");--> statement-breakpoint
CREATE INDEX "resource_chunk_bm25_idx" ON "chia_resource_chunk" USING paradedb ("id",(("content")::pdb.icu),(("content")::pdb.simple('alias=body_sub')),"source_type","kind","locale","published","deleted") WITH (key_field=id);
