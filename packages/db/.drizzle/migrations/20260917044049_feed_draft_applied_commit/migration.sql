ALTER TABLE "chia_feed_draft" ADD COLUMN "applied_revision_id" bigint;--> statement-breakpoint
-- The row kept at the applied revision is that version: it becomes the commit.
UPDATE "chia_feed_draft_revision" r SET "kind" = 'commit', "message" = 'Applied before version history'
FROM "chia_feed_draft" d
WHERE d."applied_revision" IS NOT NULL
  AND r."id" = (
    SELECT max(r2."id") FROM "chia_feed_draft_revision" r2
    WHERE r2."draft_id" = d."id" AND r2."revision" = d."applied_revision"
  );--> statement-breakpoint
-- Coalescing may have dropped that row; then the post itself is what was applied.
INSERT INTO "chia_feed_draft_revision"
  ("draft_id", "kind", "revision", "author", "message", "snapshot", "content_hash", "created_at", "updated_at")
SELECT d."id", 'commit', d."applied_revision", 'operator', 'Applied before version history',
  jsonb_build_object(
    'slug', f."slug",
    'type', f."type"::text,
    'defaultLocale', f."default_locale"::text,
    'mainImage', f."main_image",
    'translations', coalesce((
      SELECT jsonb_object_agg(t."locale"::text, jsonb_build_object(
        'title', t."title",
        'excerpt', t."excerpt",
        'description', t."description",
        'summary', t."summary",
        'content', t."content"
      ))
      FROM "chia_feed_translation" t WHERE t."feed_id" = f."id"
    ), '{}'::jsonb)
  ),
  '', f."updated_at", f."updated_at"
FROM "chia_feed_draft" d
JOIN "chia_feed" f ON f."id" = d."feed_id"
WHERE d."applied_revision" IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM "chia_feed_draft_revision" r
    WHERE r."draft_id" = d."id" AND r."kind" = 'commit'
  );--> statement-breakpoint
-- Mirrors `hashFeedDraftSnapshot`: `-` for null, else `+<utf-8 byte length>:<value>`.
CREATE OR REPLACE FUNCTION pg_temp.chia_hash_field(value text) RETURNS text
LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE WHEN value IS NULL THEN '-' ELSE '+' || octet_length(value) || ':' || value END
$$;--> statement-breakpoint
UPDATE "chia_feed_draft_revision" r SET "content_hash" = encode(sha256(convert_to(
  pg_temp.chia_hash_field(r."snapshot"->>'slug')
  || pg_temp.chia_hash_field(r."snapshot"->>'type')
  || pg_temp.chia_hash_field(r."snapshot"->>'defaultLocale')
  || pg_temp.chia_hash_field(r."snapshot"->>'mainImage')
  || coalesce((
    SELECT string_agg(
      pg_temp.chia_hash_field(e.key)
      || pg_temp.chia_hash_field(e.value->>'title')
      || pg_temp.chia_hash_field(e.value->>'excerpt')
      || pg_temp.chia_hash_field(e.value->>'description')
      || pg_temp.chia_hash_field(e.value->>'summary')
      || pg_temp.chia_hash_field(e.value->>'content'),
      '' ORDER BY e.key COLLATE "C"
    )
    FROM jsonb_each(r."snapshot"->'translations') e
  ), ''),
  'UTF8')), 'hex')
WHERE r."content_hash" = '';--> statement-breakpoint
UPDATE "chia_feed_draft" d SET "applied_revision_id" = (
  SELECT max(r."id") FROM "chia_feed_draft_revision" r
  WHERE r."draft_id" = d."id" AND r."kind" = 'commit'
)
WHERE d."applied_revision" IS NOT NULL;--> statement-breakpoint
ALTER TABLE "chia_feed_draft" DROP COLUMN "applied_revision";--> statement-breakpoint
ALTER TABLE "chia_feed_draft" ADD CONSTRAINT "chia_feed_draft_nW8IgPO6tpcH_fkey" FOREIGN KEY ("applied_revision_id") REFERENCES "chia_feed_draft_revision"("id");
