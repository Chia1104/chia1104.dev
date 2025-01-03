CREATE TYPE "public"."content_type" AS ENUM('mdx', 'notion', 'tiptap', 'plate');--> statement-breakpoint
CREATE TYPE "public"."feed_type" AS ENUM('post', 'note');--> statement-breakpoint
CREATE TYPE "public"."role" AS ENUM('admin', 'user');--> statement-breakpoint
CREATE TABLE "chia_account" (
	"userId" text NOT NULL,
	"type" text NOT NULL,
	"provider" text NOT NULL,
	"providerAccountId" text NOT NULL,
	"refresh_token" text,
	"access_token" text,
	"expires_at" integer,
	"token_type" text,
	"scope" text,
	"id_token" text,
	"session_state" text,
	CONSTRAINT "chia_account_provider_providerAccountId_pk" PRIMARY KEY("provider","providerAccountId")
);
--> statement-breakpoint
CREATE TABLE "chia_asset" (
	"id" serial PRIMARY KEY NOT NULL,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"name" text NOT NULL,
	"extention" text,
	"url" text NOT NULL,
	"userId" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chia_assets_to_tags" (
	"assetId" integer NOT NULL,
	"tagId" integer NOT NULL,
	CONSTRAINT "chia_assets_to_tags_assetId_tagId_pk" PRIMARY KEY("assetId","tagId")
);
--> statement-breakpoint
CREATE TABLE "chia_content" (
	"id" serial PRIMARY KEY NOT NULL,
	"feedId" integer NOT NULL,
	"content" text,
	"source" text,
	"unstable_serializedSource" text
);
--> statement-breakpoint
CREATE TABLE "chia_feed" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"readTime" integer,
	"type" "feed_type" NOT NULL,
	"contentType" "content_type" DEFAULT 'mdx' NOT NULL,
	"published" boolean DEFAULT false,
	"title" text NOT NULL,
	"excerpt" text,
	"description" text,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"userId" text NOT NULL,
	CONSTRAINT "chia_feed_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "chia_feeds_to_tags" (
	"feedId" integer NOT NULL,
	"tagId" integer NOT NULL,
	CONSTRAINT "chia_feeds_to_tags_feedId_tagId_pk" PRIMARY KEY("feedId","tagId")
);
--> statement-breakpoint
CREATE TABLE "chia_session" (
	"sessionToken" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"expires" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chia_tag" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"description" text,
	CONSTRAINT "chia_tag_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "chia_user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text,
	"email" text,
	"emailVerified" timestamp,
	"image" text,
	"role" "role" DEFAULT 'user' NOT NULL,
	CONSTRAINT "chia_user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "chia_verificationToken" (
	"identifier" text NOT NULL,
	"token" text NOT NULL,
	"expires" timestamp NOT NULL,
	CONSTRAINT "chia_verificationToken_identifier_token_pk" PRIMARY KEY("identifier","token")
);
--> statement-breakpoint
ALTER TABLE "chia_account" ADD CONSTRAINT "chia_account_userId_chia_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."chia_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chia_asset" ADD CONSTRAINT "chia_asset_userId_chia_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."chia_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chia_assets_to_tags" ADD CONSTRAINT "chia_assets_to_tags_assetId_chia_asset_id_fk" FOREIGN KEY ("assetId") REFERENCES "public"."chia_asset"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chia_assets_to_tags" ADD CONSTRAINT "chia_assets_to_tags_tagId_chia_tag_id_fk" FOREIGN KEY ("tagId") REFERENCES "public"."chia_tag"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chia_content" ADD CONSTRAINT "chia_content_feedId_chia_feed_id_fk" FOREIGN KEY ("feedId") REFERENCES "public"."chia_feed"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chia_feed" ADD CONSTRAINT "chia_feed_userId_chia_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."chia_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chia_feeds_to_tags" ADD CONSTRAINT "chia_feeds_to_tags_feedId_chia_feed_id_fk" FOREIGN KEY ("feedId") REFERENCES "public"."chia_feed"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chia_feeds_to_tags" ADD CONSTRAINT "chia_feeds_to_tags_tagId_chia_tag_id_fk" FOREIGN KEY ("tagId") REFERENCES "public"."chia_tag"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chia_session" ADD CONSTRAINT "chia_session_userId_chia_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."chia_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "asset_id_index" ON "chia_asset" USING btree ("id");--> statement-breakpoint
CREATE UNIQUE INDEX "feed_id_index" ON "chia_feed" USING btree ("id");--> statement-breakpoint
CREATE UNIQUE INDEX "feed_slug_index" ON "chia_feed" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "feed_title_index" ON "chia_feed" USING btree ("title");--> statement-breakpoint
CREATE UNIQUE INDEX "tag_id_index" ON "chia_tag" USING btree ("id");--> statement-breakpoint
CREATE UNIQUE INDEX "tag_slug_index" ON "chia_tag" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "tag_name_index" ON "chia_tag" USING btree ("name");