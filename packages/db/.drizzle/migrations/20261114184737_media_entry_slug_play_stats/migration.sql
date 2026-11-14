ALTER TABLE "chia_media_entry" ADD COLUMN "slug" text;--> statement-breakpoint
-- Rows logged before slugs existed are named by their catalogue id, which is already unique.
UPDATE "chia_media_entry" SET "slug" = replace("source", ':', '-') || '-' || "source_id";--> statement-breakpoint
ALTER TABLE "chia_media_entry" ALTER COLUMN "slug" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "chia_media_entry" ADD COLUMN "steam_app_id" integer;--> statement-breakpoint
ALTER TABLE "chia_media_entry" ADD COLUMN "playtime_minutes" integer;--> statement-breakpoint
ALTER TABLE "chia_media_entry" ADD COLUMN "achievements_unlocked" integer;--> statement-breakpoint
ALTER TABLE "chia_media_entry" ADD COLUMN "achievements_total" integer;--> statement-breakpoint
ALTER TABLE "chia_media_entry" ADD COLUMN "last_played_at" timestamp with time zone;--> statement-breakpoint
CREATE UNIQUE INDEX "media_entry_slug_idx" ON "chia_media_entry" ("slug");