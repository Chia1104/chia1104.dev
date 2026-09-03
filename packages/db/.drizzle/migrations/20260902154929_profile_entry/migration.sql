CREATE TABLE "chia_profile_entry" (
	"id" serial PRIMARY KEY,
	"kind" text NOT NULL,
	"published" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"data" jsonb NOT NULL,
	"user_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE INDEX "profile_entry_user_kind_sort_idx" ON "chia_profile_entry" ("user_id","kind","sort_order");--> statement-breakpoint
ALTER TABLE "chia_profile_entry" ADD CONSTRAINT "chia_profile_entry_user_id_chia_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "chia_user"("id") ON DELETE CASCADE;