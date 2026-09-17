ALTER TABLE "agent"."memory" ADD COLUMN "fetched_at" timestamp with time zone;--> statement-breakpoint
UPDATE "agent"."memory" SET "fetched_at" = "updated_at" WHERE "kind" = 'source';
