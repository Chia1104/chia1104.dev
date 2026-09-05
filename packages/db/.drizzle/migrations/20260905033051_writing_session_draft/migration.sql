CREATE TABLE "agent"."writing_session_draft" (
	"session_id" text,
	"draft_id" integer,
	"last_seen_revision" integer DEFAULT 0 NOT NULL,
	"touched_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "writing_session_draft_pkey" PRIMARY KEY("session_id","draft_id")
);
--> statement-breakpoint
INSERT INTO "agent"."writing_session_draft" ("session_id", "draft_id", "last_seen_revision", "touched_at")
SELECT "session_id", "draft_id", "last_seen_revision", now()
FROM "agent"."writing_session"
WHERE "draft_id" IS NOT NULL;--> statement-breakpoint
ALTER TABLE "agent"."writing_session" DROP CONSTRAINT "writing_session_draft_id_chia_feed_draft_id_fkey";--> statement-breakpoint
DROP INDEX "agent"."writing_agent_session_draft_idx";--> statement-breakpoint
ALTER TABLE "agent"."writing_session" DROP COLUMN "draft_id";--> statement-breakpoint
ALTER TABLE "agent"."writing_session" DROP COLUMN "last_seen_revision";--> statement-breakpoint
CREATE INDEX "writing_session_draft_draft_idx" ON "agent"."writing_session_draft" ("draft_id");--> statement-breakpoint
ALTER TABLE "agent"."writing_session_draft" ADD CONSTRAINT "writing_session_draft_YjpXzzCQIvmN_fkey" FOREIGN KEY ("session_id") REFERENCES "agent"."writing_session"("session_id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "agent"."writing_session_draft" ADD CONSTRAINT "writing_session_draft_draft_id_chia_feed_draft_id_fkey" FOREIGN KEY ("draft_id") REFERENCES "chia_feed_draft"("id") ON DELETE CASCADE;