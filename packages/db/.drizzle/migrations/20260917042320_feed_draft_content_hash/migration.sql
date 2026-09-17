ALTER TABLE "chia_feed_draft_revision" ADD COLUMN "content_hash" text;--> statement-breakpoint
ALTER TABLE "chia_feed_draft" ADD COLUMN "content_hash" text;--> statement-breakpoint
-- Mirrors `hashFeedDraftSnapshot`: `-` for null, else `+<utf-8 byte length>:<value>`.
CREATE OR REPLACE FUNCTION pg_temp.chia_hash_field(value text) RETURNS text
LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE WHEN value IS NULL THEN '-' ELSE '+' || octet_length(value) || ':' || value END
$$;--> statement-breakpoint
UPDATE "chia_feed_draft" d SET "content_hash" = encode(sha256(convert_to(
  pg_temp.chia_hash_field(d."slug")
  || pg_temp.chia_hash_field(d."type"::text)
  || pg_temp.chia_hash_field(d."default_locale"::text)
  || pg_temp.chia_hash_field(d."main_image")
  || coalesce((
    SELECT string_agg(
      pg_temp.chia_hash_field(t."locale"::text)
      || pg_temp.chia_hash_field(t."title")
      || pg_temp.chia_hash_field(t."excerpt")
      || pg_temp.chia_hash_field(t."description")
      || pg_temp.chia_hash_field(t."summary")
      || pg_temp.chia_hash_field(t."content"),
      '' ORDER BY t."locale"::text COLLATE "C"
    )
    FROM "chia_feed_draft_translation" t
    WHERE t."draft_id" = d."id"
  ), ''),
  'UTF8')), 'hex');--> statement-breakpoint
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
  'UTF8')), 'hex');--> statement-breakpoint
ALTER TABLE "chia_feed_draft_revision" ALTER COLUMN "content_hash" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "chia_feed_draft" ALTER COLUMN "content_hash" SET NOT NULL;
