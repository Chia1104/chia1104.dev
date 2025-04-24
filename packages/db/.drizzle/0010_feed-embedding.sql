ALTER TABLE "chia_feed" ADD COLUMN "embedding" vector(1536);--> statement-breakpoint
CREATE INDEX "feed_embedding_index" ON "chia_feed" USING hnsw ("embedding" vector_cosine_ops);