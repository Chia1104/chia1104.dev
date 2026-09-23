ALTER TABLE "chia_assets_to_tags" DROP CONSTRAINT "chia_assets_to_tags_asset_id_chia_asset_id_fk";--> statement-breakpoint
DROP TABLE "chia_asset";--> statement-breakpoint
DROP TABLE "chia_assets_to_tags";--> statement-breakpoint
DROP INDEX "feeds_to_tags_feed_id_idx";--> statement-breakpoint
DROP INDEX "tag_translation_tag_id_idx";--> statement-breakpoint
DROP INDEX "tag_translation_locale_idx";--> statement-breakpoint
DROP INDEX "tag_translation_name_idx";--> statement-breakpoint
DROP INDEX "tag_slug_idx";