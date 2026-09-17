ALTER TABLE "chia_feed_draft_revision" ADD COLUMN "kind" text;--> statement-breakpoint
ALTER TABLE "chia_feed_draft_revision" ADD COLUMN "message" text;--> statement-breakpoint
ALTER TABLE "chia_feed_draft_revision" ADD COLUMN "pinned" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "chia_feed_draft" ADD COLUMN "last_author" text;--> statement-breakpoint
ALTER TABLE "chia_feed_draft" ADD COLUMN "last_session_id" text;--> statement-breakpoint
UPDATE "chia_feed_draft_revision" SET "kind" = 'safety';--> statement-breakpoint
-- Every write so far left a row at the draft's own revision, so the newest row names the last writer.
UPDATE "chia_feed_draft" d SET
  "last_author" = coalesce((
    SELECT r."author" FROM "chia_feed_draft_revision" r
    WHERE r."draft_id" = d."id" ORDER BY r."id" DESC LIMIT 1
  ), 'operator'),
  "last_session_id" = (
    SELECT r."session_id" FROM "chia_feed_draft_revision" r
    WHERE r."draft_id" = d."id" ORDER BY r."id" DESC LIMIT 1
  );--> statement-breakpoint
ALTER TABLE "chia_feed_draft_revision" ALTER COLUMN "kind" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "chia_feed_draft" ALTER COLUMN "last_author" SET NOT NULL;--> statement-breakpoint
DROP INDEX "feed_draft_revision_draft_revision_idx";--> statement-breakpoint
CREATE INDEX "feed_draft_revision_draft_revision_idx" ON "chia_feed_draft_revision" ("draft_id","revision");
