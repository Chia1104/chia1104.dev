ALTER TABLE "chia_feed" ADD COLUMN "deleted_at" timestamp;--> statement-breakpoint
CREATE INDEX "feed_deleted_at_idx" ON "chia_feed" ("deleted_at");