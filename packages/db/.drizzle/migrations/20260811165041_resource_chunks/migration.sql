CREATE TABLE "chia_resource_chunk" (
	"id" bigserial PRIMARY KEY,
	"feed_translation_id" integer,
	"source_type" text GENERATED ALWAYS AS (case when "feed_translation_id" is not null then 'feed_translation' end) STORED NOT NULL,
	"source_id" integer GENERATED ALWAYS AS (coalesce("feed_translation_id")) STORED NOT NULL,
	"kind" text NOT NULL,
	"chunk_index" integer DEFAULT 0 NOT NULL,
	"content" text NOT NULL,
	"heading_path" text,
	"token_count" integer,
	"metadata" jsonb,
	"content_hash" text NOT NULL,
	"locale" "locale",
	"published" boolean DEFAULT false NOT NULL,
	"deleted" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "resource_chunk_single_source" CHECK (num_nonnulls("feed_translation_id") = 1)
);
--> statement-breakpoint
CREATE TABLE "chia_resource_embedding" (
	"chunk_id" bigint,
	"model" text,
	"index_version" text NOT NULL,
	"embedding" vector(1536) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "chia_resource_embedding_pkey" PRIMARY KEY("chunk_id","model")
);
--> statement-breakpoint
ALTER TABLE "chia_feed_translation" ADD COLUMN "content" text;--> statement-breakpoint
ALTER TABLE "chia_feed_translation" ADD COLUMN "source" text;--> statement-breakpoint
ALTER TABLE "chia_feed_translation" ADD COLUMN "unstable_serialized_source" text;--> statement-breakpoint
ALTER TABLE "chia_feed_translation" ADD COLUMN "published" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "chia_feed_translation" ADD COLUMN "deleted" boolean DEFAULT false NOT NULL;--> statement-breakpoint
-- Copy the body across before dropping the old tables. drizzle-kit emits the
-- DROPs before the new columns exist.
UPDATE "chia_feed_translation" AS t
SET "content" = c."content",
    "source" = c."source",
    "unstable_serialized_source" = c."unstable_serialized_source"
FROM "chia_content" AS c
WHERE c."feed_translation_id" = t."id";--> statement-breakpoint
UPDATE "chia_feed_translation" AS t
SET "published" = f."published",
    "deleted" = f."deleted_at" IS NOT NULL
FROM "chia_feed" AS f
WHERE f."id" = t."feed_id";--> statement-breakpoint
DROP TABLE "chia_content";--> statement-breakpoint
DROP TABLE "chia_feed_embedding";--> statement-breakpoint
CREATE UNIQUE INDEX "resource_chunk_source_kind_index_idx" ON "chia_resource_chunk" ("source_type","source_id","kind","chunk_index");--> statement-breakpoint
CREATE INDEX "resource_chunk_source_idx" ON "chia_resource_chunk" ("source_type","source_id");--> statement-breakpoint
CREATE INDEX "resource_chunk_feed_translation_id_idx" ON "chia_resource_chunk" ("feed_translation_id");--> statement-breakpoint
CREATE INDEX "resource_chunk_bm25_idx" ON "chia_resource_chunk" USING paradedb ("id",(("content")::pdb.icu),(("content")::pdb.simple('alias=body_sub')),"source_type","kind","locale","published","deleted") WITH (key_field=id);--> statement-breakpoint
CREATE INDEX "resource_embedding_model_idx" ON "chia_resource_embedding" ("model");--> statement-breakpoint
CREATE INDEX "resource_embedding_hnsw_idx" ON "chia_resource_embedding" USING hnsw ("embedding" vector_cosine_ops);--> statement-breakpoint
ALTER TABLE "chia_resource_chunk" ADD CONSTRAINT "chia_resource_chunk_yDIuddFEqwIc_fkey" FOREIGN KEY ("feed_translation_id") REFERENCES "chia_feed_translation"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "chia_resource_embedding" ADD CONSTRAINT "chia_resource_embedding_chunk_id_chia_resource_chunk_id_fkey" FOREIGN KEY ("chunk_id") REFERENCES "chia_resource_chunk"("id") ON DELETE CASCADE;