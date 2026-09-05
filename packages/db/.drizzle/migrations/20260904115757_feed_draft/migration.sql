CREATE TABLE "chia_feed_draft_revision" (
	"id" bigserial PRIMARY KEY,
	"draft_id" integer NOT NULL,
	"revision" integer NOT NULL,
	"author" text NOT NULL,
	"session_id" text,
	"changes" jsonb DEFAULT '[]' NOT NULL,
	"snapshot" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chia_feed_draft_translation" (
	"draft_id" integer,
	"locale" "locale",
	"title" text,
	"excerpt" text,
	"description" text,
	"summary" text,
	"content" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chia_feed_draft_translation_pkey" PRIMARY KEY("draft_id","locale")
);
--> statement-breakpoint
CREATE TABLE "chia_feed_draft" (
	"id" serial PRIMARY KEY,
	"feed_id" integer,
	"user_id" text NOT NULL,
	"slug" text,
	"type" "feed_type" DEFAULT 'post'::"feed_type" NOT NULL,
	"default_locale" "locale" DEFAULT 'zh-TW'::"locale" NOT NULL,
	"main_image" text,
	"revision" integer DEFAULT 1 NOT NULL,
	"applied_revision" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "agent"."writing_session" ADD COLUMN "draft_id" integer;--> statement-breakpoint
ALTER TABLE "agent"."writing_session" ADD COLUMN "last_seen_revision" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
-- Every live writing session keeps its staging buffer as a shared draft. A feed has one draft,
-- so when several sessions target the same feed the most recently updated one binds it and
-- the rest continue as unbound drafts.
ALTER TABLE "chia_feed_draft" ADD COLUMN "migrated_session_id" text;--> statement-breakpoint
INSERT INTO "chia_feed_draft" ("feed_id", "user_id", "slug", "type", "default_locale", "main_image", "revision", "applied_revision", "migrated_session_id")
SELECT
	CASE WHEN m."rank" = 1 THEN m."target_feed_id" END,
	m."user_id",
	COALESCE(m."feed_meta"->>'slug', f."slug"),
	COALESCE((m."feed_meta"->>'type')::"feed_type", f."type", 'post'::"feed_type"),
	COALESCE((m."feed_meta"->>'defaultLocale')::"locale", f."default_locale", 'zh-TW'::"locale"),
	COALESCE(m."feed_meta"->>'mainImage', f."main_image"),
	1,
	CASE WHEN m."rank" = 1 AND m."target_feed_id" IS NOT NULL THEN 1 END,
	m."session_id"
FROM (
	SELECT ws."session_id", s."user_id", ws."target_feed_id", ws."feed_meta",
		row_number() OVER (PARTITION BY ws."target_feed_id" ORDER BY s."updated_at" DESC) AS "rank"
	FROM "agent"."writing_session" ws
	JOIN "agent"."session" s ON s."id" = ws."session_id"
	WHERE s."deleted_at" IS NULL
) m
LEFT JOIN "chia_feed" f ON f."id" = m."target_feed_id";--> statement-breakpoint
INSERT INTO "chia_feed_draft_translation" ("draft_id", "locale", "title", "excerpt", "description", "summary", "content")
SELECT d."id", wd."locale", wd."meta"->>'title', wd."meta"->>'excerpt', wd."meta"->>'description', wd."meta"->>'summary', wd."content"
FROM "agent"."writing_draft" wd
JOIN "chia_feed_draft" d ON d."migrated_session_id" = wd."session_id";--> statement-breakpoint
INSERT INTO "chia_feed_draft_revision" ("draft_id", "revision", "author", "session_id", "changes", "snapshot")
SELECT d."id", 1, 'agent', d."migrated_session_id", '[]'::jsonb,
	jsonb_build_object(
		'slug', d."slug",
		'type', d."type",
		'defaultLocale', d."default_locale",
		'mainImage', d."main_image",
		'translations', COALESCE((
			SELECT jsonb_object_agg(t."locale", jsonb_build_object(
				'title', t."title", 'excerpt', t."excerpt", 'description', t."description", 'summary', t."summary", 'content', t."content"))
			FROM "chia_feed_draft_translation" t WHERE t."draft_id" = d."id"
		), '{}'::jsonb)
	)
FROM "chia_feed_draft" d
WHERE d."migrated_session_id" IS NOT NULL;--> statement-breakpoint
UPDATE "agent"."writing_session" ws SET "draft_id" = d."id"
FROM "chia_feed_draft" d WHERE d."migrated_session_id" = ws."session_id";--> statement-breakpoint
ALTER TABLE "chia_feed_draft" DROP COLUMN "migrated_session_id";--> statement-breakpoint
ALTER TABLE "agent"."writing_session" DROP CONSTRAINT "chia_writing_agent_session_target_feed_id_chia_feed_id_fkey";--> statement-breakpoint
DROP TABLE "agent"."writing_draft";--> statement-breakpoint
DROP INDEX "agent"."writing_agent_session_target_feed_idx";--> statement-breakpoint
ALTER TABLE "agent"."writing_session" DROP COLUMN "target_feed_id";--> statement-breakpoint
ALTER TABLE "agent"."writing_session" DROP COLUMN "feed_meta";--> statement-breakpoint
ALTER TABLE "chia_feed_translation" DROP COLUMN "source";--> statement-breakpoint
ALTER TABLE "chia_feed_translation" DROP COLUMN "unstable_serialized_source";--> statement-breakpoint
ALTER TABLE "chia_feed" DROP COLUMN "content_type";--> statement-breakpoint
CREATE UNIQUE INDEX "feed_draft_revision_draft_revision_idx" ON "chia_feed_draft_revision" ("draft_id","revision");--> statement-breakpoint
CREATE UNIQUE INDEX "feed_draft_feed_id_idx" ON "chia_feed_draft" ("feed_id");--> statement-breakpoint
CREATE INDEX "feed_draft_user_id_idx" ON "chia_feed_draft" ("user_id");--> statement-breakpoint
CREATE INDEX "feed_draft_updated_at_idx" ON "chia_feed_draft" ("updated_at");--> statement-breakpoint
CREATE INDEX "writing_agent_session_draft_idx" ON "agent"."writing_session" ("draft_id");--> statement-breakpoint
ALTER TABLE "chia_feed_draft_revision" ADD CONSTRAINT "chia_feed_draft_revision_draft_id_chia_feed_draft_id_fkey" FOREIGN KEY ("draft_id") REFERENCES "chia_feed_draft"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "chia_feed_draft_translation" ADD CONSTRAINT "chia_feed_draft_translation_draft_id_chia_feed_draft_id_fkey" FOREIGN KEY ("draft_id") REFERENCES "chia_feed_draft"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "chia_feed_draft" ADD CONSTRAINT "chia_feed_draft_feed_id_chia_feed_id_fkey" FOREIGN KEY ("feed_id") REFERENCES "chia_feed"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "chia_feed_draft" ADD CONSTRAINT "chia_feed_draft_user_id_chia_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "chia_user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "agent"."writing_session" ADD CONSTRAINT "writing_session_draft_id_chia_feed_draft_id_fkey" FOREIGN KEY ("draft_id") REFERENCES "chia_feed_draft"("id") ON DELETE SET NULL;--> statement-breakpoint
DROP TYPE "content_type";