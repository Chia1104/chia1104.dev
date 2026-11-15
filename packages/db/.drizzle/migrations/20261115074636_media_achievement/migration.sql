CREATE TABLE "chia_media_achievement" (
	"id" serial PRIMARY KEY,
	"media_entry_id" integer NOT NULL,
	"api_name" text NOT NULL,
	"translations" jsonb NOT NULL,
	"icon_url" text NOT NULL,
	"locked_icon_url" text NOT NULL,
	"hidden" boolean NOT NULL,
	"global_percent" real,
	"unlocked" boolean NOT NULL,
	"unlocked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "media_achievement_entry_api_name_idx" ON "chia_media_achievement" ("media_entry_id","api_name");--> statement-breakpoint
ALTER TABLE "chia_media_achievement" ADD CONSTRAINT "chia_media_achievement_media_entry_id_chia_media_entry_id_fkey" FOREIGN KEY ("media_entry_id") REFERENCES "chia_media_entry"("id") ON DELETE CASCADE;