ALTER TYPE "feed_type" ADD VALUE 'guide';--> statement-breakpoint
ALTER TYPE "feed_type" ADD VALUE 'review';--> statement-breakpoint
ALTER TYPE "feed_type" ADD VALUE 'journal';--> statement-breakpoint
ALTER TABLE "chia_feed" ADD COLUMN "media_entry_id" integer;--> statement-breakpoint
CREATE INDEX "feed_media_entry_id_idx" ON "chia_feed" ("media_entry_id");--> statement-breakpoint
ALTER TABLE "chia_feed" ADD CONSTRAINT "chia_feed_media_entry_id_chia_media_entry_id_fkey" FOREIGN KEY ("media_entry_id") REFERENCES "chia_media_entry"("id") ON DELETE SET NULL;