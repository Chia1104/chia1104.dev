-- `summary` leaves the draft: the summarize workflow writes `feed_translation.summary` and an
-- apply must not overwrite it. Revision snapshots drop the key and both tables are rehashed
-- with the new layout, so a draft still matches the commit it holds.
ALTER TABLE "chia_feed_draft_translation" DROP COLUMN "summary";--> statement-breakpoint
UPDATE "chia_feed_draft_revision" r SET "snapshot" = jsonb_set(
  r."snapshot",
  '{translations}',
  coalesce((
    SELECT jsonb_object_agg(e.key, e.value - 'summary')
    FROM jsonb_each(r."snapshot"->'translations') e
  ), '{}'::jsonb)
);--> statement-breakpoint
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
      || pg_temp.chia_hash_field(e.value->>'content'),
      '' ORDER BY e.key COLLATE "C"
    )
    FROM jsonb_each(r."snapshot"->'translations') e
  ), ''),
  'UTF8')), 'hex');
