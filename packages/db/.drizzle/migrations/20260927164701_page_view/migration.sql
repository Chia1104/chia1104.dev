CREATE TABLE "chia_page_view" (
	"id" bigserial PRIMARY KEY,
	"path" text NOT NULL,
	"feed_id" integer,
	"locale" "locale" NOT NULL,
	"visitor" text NOT NULL,
	"referrer_host" text,
	"country" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "page_view_created_at_idx" ON "chia_page_view" ("created_at");--> statement-breakpoint
CREATE INDEX "page_view_feed_id_created_at_idx" ON "chia_page_view" ("feed_id","created_at");--> statement-breakpoint
CREATE INDEX "page_view_path_created_at_idx" ON "chia_page_view" ("path","created_at");--> statement-breakpoint
ALTER TABLE "chia_page_view" ADD CONSTRAINT "chia_page_view_feed_id_chia_feed_id_fkey" FOREIGN KEY ("feed_id") REFERENCES "chia_feed"("id") ON DELETE SET NULL;