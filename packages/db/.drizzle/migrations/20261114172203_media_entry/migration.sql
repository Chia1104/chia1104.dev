CREATE TABLE "chia_media_entry" (
	"id" serial PRIMARY KEY,
	"kind" text NOT NULL,
	"source" text NOT NULL,
	"source_id" text NOT NULL,
	"source_url" text,
	"translations" jsonb NOT NULL,
	"original_title" text,
	"release_year" integer,
	"poster" text,
	"status" text NOT NULL,
	"rating" smallint,
	"favorite" boolean DEFAULT false NOT NULL,
	"started_on" date,
	"finished_on" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "media_entry_source_idx" ON "chia_media_entry" ("source","source_id");--> statement-breakpoint
CREATE INDEX "media_entry_kind_status_idx" ON "chia_media_entry" ("kind","status");