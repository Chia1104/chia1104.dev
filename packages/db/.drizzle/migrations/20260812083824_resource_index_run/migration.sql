CREATE TABLE "chia_resource_index_run" (
	"id" bigserial PRIMARY KEY,
	"external_run_id" text NOT NULL,
	"scope" text NOT NULL,
	"source_type" text,
	"source_id" integer,
	"feed_id" integer,
	"status" text DEFAULT 'pending' NOT NULL,
	"triggered_by" text,
	"model" text NOT NULL,
	"index_version" text NOT NULL,
	"progress" jsonb,
	"result" jsonb,
	"error" text,
	"started_at" timestamp,
	"ended_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "resource_index_run_source_idx" ON "chia_resource_index_run" ("source_type","source_id");--> statement-breakpoint
CREATE INDEX "resource_index_run_external_id_idx" ON "chia_resource_index_run" ("external_run_id");--> statement-breakpoint
CREATE UNIQUE INDEX "resource_index_run_active_resource_idx" ON "chia_resource_index_run" ("source_type","source_id") WHERE "scope" = 'resource' and "status" in ('pending', 'running');--> statement-breakpoint
CREATE UNIQUE INDEX "resource_index_run_active_feed_idx" ON "chia_resource_index_run" ("feed_id") WHERE "scope" = 'feed' and "status" in ('pending', 'running');--> statement-breakpoint
CREATE UNIQUE INDEX "resource_index_run_active_all_idx" ON "chia_resource_index_run" ("scope") WHERE "scope" = 'all' and "status" in ('pending', 'running');--> statement-breakpoint
ALTER TABLE "chia_resource_index_run" ADD CONSTRAINT "chia_resource_index_run_feed_id_chia_feed_id_fkey" FOREIGN KEY ("feed_id") REFERENCES "chia_feed"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "chia_resource_index_run" ADD CONSTRAINT "chia_resource_index_run_triggered_by_chia_user_id_fkey" FOREIGN KEY ("triggered_by") REFERENCES "chia_user"("id");