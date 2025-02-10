CREATE TYPE "public"."i18n" AS ENUM('en', 'zh-tw');--> statement-breakpoint
CREATE TABLE "chia_feed_meta" (
	"id" serial PRIMARY KEY NOT NULL,
	"feedId" integer NOT NULL,
	"mainI18n" "i18n",
	"mainImage" text,
	"summary" text
);
--> statement-breakpoint
ALTER TABLE "chia_feed_meta" ADD CONSTRAINT "chia_feed_meta_feedId_chia_feed_id_fk" FOREIGN KEY ("feedId") REFERENCES "public"."chia_feed"("id") ON DELETE cascade ON UPDATE no action;