CREATE TABLE "chia_feed_embedding" (
	"id" serial PRIMARY KEY,
	"feed_translation_id" integer NOT NULL,
	"model" text NOT NULL,
	"kind" text DEFAULT 'document' NOT NULL,
	"chunk_index" integer DEFAULT 0 NOT NULL,
	"chunk_text" text,
	"heading_path" text,
	"token_count" integer,
	"content_hash" text NOT NULL,
	"index_version" text NOT NULL,
	"embedding_1536" vector(1536),
	"embedding_512" vector(512),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
-- Backfill: copy existing document-level vectors into the new table BEFORE
-- the columns are dropped. content_hash/index_version use the 'legacy'
-- sentinel — it never matches a real sha-256 / EMBEDDING_INDEX_VERSION, so
-- the next syncFeedSearchIndex re-embeds everything (including the new chunk
-- rows) while these vectors keep serving search until then.
INSERT INTO "chia_feed_embedding" ("feed_translation_id", "model", "kind", "chunk_index", "content_hash", "index_version", "embedding_1536", "created_at", "updated_at")
SELECT "id", 'text-embedding-3-small', 'document', 0, 'legacy', 'legacy', "embedding", "created_at", "updated_at"
FROM "chia_feed_translation"
WHERE "embedding" IS NOT NULL;--> statement-breakpoint
INSERT INTO "chia_feed_embedding" ("feed_translation_id", "model", "kind", "chunk_index", "content_hash", "index_version", "embedding_512", "created_at", "updated_at")
SELECT "id", 'nomic-embed-text', 'document', 0, 'legacy', 'legacy', "embedding512", "created_at", "updated_at"
FROM "chia_feed_translation"
WHERE "embedding512" IS NOT NULL;--> statement-breakpoint
DROP INDEX "feed_translation_embedding_idx";--> statement-breakpoint
DROP INDEX "feed_translation_embedding512_idx";--> statement-breakpoint
ALTER TABLE "chia_feed_translation" DROP COLUMN "embedding";--> statement-breakpoint
ALTER TABLE "chia_feed_translation" DROP COLUMN "embedding512";--> statement-breakpoint
CREATE UNIQUE INDEX "feed_embedding_translation_model_kind_chunk_idx" ON "chia_feed_embedding" ("feed_translation_id","model","kind","chunk_index");--> statement-breakpoint
CREATE INDEX "feed_embedding_translation_id_idx" ON "chia_feed_embedding" ("feed_translation_id");--> statement-breakpoint
CREATE INDEX "feed_embedding_model_idx" ON "chia_feed_embedding" ("model");--> statement-breakpoint
CREATE INDEX "feed_embedding_kind_idx" ON "chia_feed_embedding" ("kind");--> statement-breakpoint
CREATE INDEX "feed_embedding_1536_hnsw_idx" ON "chia_feed_embedding" USING hnsw ("embedding_1536" vector_cosine_ops);--> statement-breakpoint
CREATE INDEX "feed_embedding_512_hnsw_idx" ON "chia_feed_embedding" USING hnsw ("embedding_512" vector_cosine_ops);--> statement-breakpoint
ALTER TABLE "chia_feed_embedding" ADD CONSTRAINT "chia_feed_embedding_oGTNplD9Sxv0_fkey" FOREIGN KEY ("feed_translation_id") REFERENCES "chia_feed_translation"("id") ON DELETE CASCADE;