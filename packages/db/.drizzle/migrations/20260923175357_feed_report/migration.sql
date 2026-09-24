CREATE TABLE "chia_feed_report" (
	"id" serial PRIMARY KEY,
	"feed_id" integer NOT NULL,
	"locale" "locale" NOT NULL,
	"heading_path" text,
	"quote" text,
	"category" text NOT NULL,
	"claim" text NOT NULL,
	"assessment" text NOT NULL,
	"suggestion" text,
	"reporter_id" text,
	"session_id" text,
	"status" text DEFAULT 'open' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "feed_report_status_created_at_idx" ON "chia_feed_report" ("status","created_at");--> statement-breakpoint
CREATE INDEX "feed_report_feed_id_idx" ON "chia_feed_report" ("feed_id");--> statement-breakpoint
CREATE INDEX "feed_report_reporter_created_at_idx" ON "chia_feed_report" ("reporter_id","created_at");--> statement-breakpoint
ALTER TABLE "chia_feed_report" ADD CONSTRAINT "chia_feed_report_feed_id_chia_feed_id_fkey" FOREIGN KEY ("feed_id") REFERENCES "chia_feed"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "chia_feed_report" ADD CONSTRAINT "chia_feed_report_reporter_id_chia_user_id_fkey" FOREIGN KEY ("reporter_id") REFERENCES "chia_user"("id") ON DELETE SET NULL;