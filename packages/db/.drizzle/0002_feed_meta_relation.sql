ALTER TABLE "public"."chia_feed_meta" ALTER COLUMN "mainI18n" SET DATA TYPE text;--> statement-breakpoint
DROP TYPE "public"."i18n";--> statement-breakpoint
CREATE TYPE "public"."i18n" AS ENUM('en', 'zh-tw');--> statement-breakpoint
ALTER TABLE "public"."chia_feed_meta" ALTER COLUMN "mainI18n" SET DATA TYPE "public"."i18n" USING "mainI18n"::"public"."i18n";