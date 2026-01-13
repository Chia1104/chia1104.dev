CREATE TYPE "public"."content_type" AS ENUM('mdx', 'notion', 'tiptap', 'plate');--> statement-breakpoint
CREATE TYPE "public"."feed_type" AS ENUM('post', 'note');--> statement-breakpoint
CREATE TYPE "public"."invitation_status" AS ENUM('pending', 'accepted', 'rejected', 'expired');--> statement-breakpoint
CREATE TYPE "public"."locale" AS ENUM('en', 'zh-TW');--> statement-breakpoint
CREATE TYPE "public"."member_role" AS ENUM('owner', 'admin', 'member');--> statement-breakpoint
CREATE TYPE "public"."role" AS ENUM('admin', 'user', 'root');--> statement-breakpoint
CREATE TABLE "chia_apikey" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text,
	"start" text,
	"prefix" text,
	"key" text NOT NULL,
	"user_id" text NOT NULL,
	"refill_interval" integer,
	"refill_amount" integer,
	"last_refill_at" timestamp,
	"rate_limit_enabled" boolean DEFAULT true,
	"rate_limit_time_window" integer DEFAULT 86400000,
	"rate_limit_max" integer DEFAULT 10,
	"request_count" integer DEFAULT 0,
	"remaining" integer,
	"last_request" timestamp,
	"enabled" boolean DEFAULT true,
	"expires_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"permissions" text,
	"metadata" text,
	"project_id" integer
);
--> statement-breakpoint
CREATE TABLE "chia_account" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp,
	"refresh_token_expires_at" timestamp,
	"scope" text,
	"password" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chia_passkey" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text,
	"public_key" text NOT NULL,
	"user_id" text NOT NULL,
	"credential_id" text NOT NULL,
	"counter" integer NOT NULL,
	"device_type" text NOT NULL,
	"backed_up" boolean NOT NULL,
	"transports" text,
	"created_at" timestamp,
	"aaguid" text
);
--> statement-breakpoint
CREATE TABLE "chia_session" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	"impersonated_by" text,
	"active_organization_id" text,
	CONSTRAINT "chia_session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "chia_verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chia_asset" (
	"id" serial PRIMARY KEY NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"name" text NOT NULL,
	"extension" text,
	"url" text NOT NULL,
	"user_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chia_assets_to_tags" (
	"asset_id" integer NOT NULL,
	"tag_id" integer NOT NULL,
	CONSTRAINT "chia_assets_to_tags_asset_id_tag_id_pk" PRIMARY KEY("asset_id","tag_id")
);
--> statement-breakpoint
CREATE TABLE "chia_content" (
	"id" serial PRIMARY KEY NOT NULL,
	"feed_translation_id" integer NOT NULL,
	"content" text,
	"source" text,
	"unstable_serialized_source" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "chia_content_feed_translation_id_unique" UNIQUE("feed_translation_id")
);
--> statement-breakpoint
CREATE TABLE "chia_feed_translation" (
	"id" serial PRIMARY KEY NOT NULL,
	"feed_id" integer NOT NULL,
	"locale" "locale" NOT NULL,
	"title" text NOT NULL,
	"excerpt" text,
	"description" text,
	"summary" text,
	"read_time" integer,
	"embedding" vector(1536),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chia_feed" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"type" "feed_type" NOT NULL,
	"content_type" "content_type" DEFAULT 'mdx' NOT NULL,
	"published" boolean DEFAULT false NOT NULL,
	"default_locale" "locale" DEFAULT 'zh-TW' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"user_id" text NOT NULL,
	"main_image" text,
	CONSTRAINT "chia_feed_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "chia_feeds_to_tags" (
	"feed_id" integer NOT NULL,
	"tag_id" integer NOT NULL,
	CONSTRAINT "chia_feeds_to_tags_feed_id_tag_id_pk" PRIMARY KEY("feed_id","tag_id")
);
--> statement-breakpoint
CREATE TABLE "chia_tag_translation" (
	"id" serial PRIMARY KEY NOT NULL,
	"tag_id" integer NOT NULL,
	"locale" "locale" NOT NULL,
	"name" text NOT NULL,
	"description" text
);
--> statement-breakpoint
CREATE TABLE "chia_tag" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "chia_tag_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "chia_invitation" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"email" text NOT NULL,
	"role" "member_role" DEFAULT 'member' NOT NULL,
	"status" "invitation_status" DEFAULT 'pending' NOT NULL,
	"expires_at" timestamp NOT NULL,
	"inviter_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chia_member" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"user_id" text NOT NULL,
	"role" "member_role" DEFAULT 'member' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chia_organization" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"logo" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"metadata" text,
	CONSTRAINT "chia_organization_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "chia_project" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"logo" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp,
	"metadata" jsonb,
	"organization_id" text NOT NULL,
	CONSTRAINT "chia_project_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "chia_user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"role" "role" DEFAULT 'user' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"banned" boolean DEFAULT false NOT NULL,
	"ban_reason" text,
	"ban_expires" timestamp,
	CONSTRAINT "chia_user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "chia_apikey" ADD CONSTRAINT "chia_apikey_user_id_chia_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."chia_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chia_apikey" ADD CONSTRAINT "chia_apikey_project_id_chia_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."chia_project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chia_account" ADD CONSTRAINT "chia_account_user_id_chia_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."chia_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chia_passkey" ADD CONSTRAINT "chia_passkey_user_id_chia_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."chia_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chia_session" ADD CONSTRAINT "chia_session_user_id_chia_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."chia_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chia_asset" ADD CONSTRAINT "chia_asset_user_id_chia_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."chia_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chia_assets_to_tags" ADD CONSTRAINT "chia_assets_to_tags_asset_id_chia_asset_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."chia_asset"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chia_assets_to_tags" ADD CONSTRAINT "chia_assets_to_tags_tag_id_chia_tag_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."chia_tag"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chia_content" ADD CONSTRAINT "chia_content_feed_translation_id_chia_feed_translation_id_fk" FOREIGN KEY ("feed_translation_id") REFERENCES "public"."chia_feed_translation"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chia_feed_translation" ADD CONSTRAINT "chia_feed_translation_feed_id_chia_feed_id_fk" FOREIGN KEY ("feed_id") REFERENCES "public"."chia_feed"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chia_feed" ADD CONSTRAINT "chia_feed_user_id_chia_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."chia_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chia_feeds_to_tags" ADD CONSTRAINT "chia_feeds_to_tags_feed_id_chia_feed_id_fk" FOREIGN KEY ("feed_id") REFERENCES "public"."chia_feed"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chia_feeds_to_tags" ADD CONSTRAINT "chia_feeds_to_tags_tag_id_chia_tag_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."chia_tag"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chia_tag_translation" ADD CONSTRAINT "chia_tag_translation_tag_id_chia_tag_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."chia_tag"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chia_invitation" ADD CONSTRAINT "chia_invitation_organization_id_chia_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."chia_organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chia_invitation" ADD CONSTRAINT "chia_invitation_inviter_id_chia_user_id_fk" FOREIGN KEY ("inviter_id") REFERENCES "public"."chia_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chia_member" ADD CONSTRAINT "chia_member_organization_id_chia_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."chia_organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chia_member" ADD CONSTRAINT "chia_member_user_id_chia_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."chia_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chia_project" ADD CONSTRAINT "chia_project_organization_id_chia_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."chia_organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "apikey_user_id_idx" ON "chia_apikey" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "apikey_key_idx" ON "chia_apikey" USING btree ("key");--> statement-breakpoint
CREATE INDEX "apikey_project_id_idx" ON "chia_apikey" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "account_user_id_idx" ON "chia_account" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "passkey_user_id_idx" ON "chia_passkey" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "passkey_credential_id_idx" ON "chia_passkey" USING btree ("credential_id");--> statement-breakpoint
CREATE INDEX "session_user_id_idx" ON "chia_session" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "verification_identifier_idx" ON "chia_verification" USING btree ("identifier");--> statement-breakpoint
CREATE INDEX "asset_user_id_idx" ON "chia_asset" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "asset_name_idx" ON "chia_asset" USING btree ("name");--> statement-breakpoint
CREATE INDEX "assets_to_tags_asset_id_idx" ON "chia_assets_to_tags" USING btree ("asset_id");--> statement-breakpoint
CREATE INDEX "assets_to_tags_tag_id_idx" ON "chia_assets_to_tags" USING btree ("tag_id");--> statement-breakpoint
CREATE UNIQUE INDEX "content_feed_translation_id_idx" ON "chia_content" USING btree ("feed_translation_id");--> statement-breakpoint
CREATE UNIQUE INDEX "feed_translation_feed_locale_idx" ON "chia_feed_translation" USING btree ("feed_id","locale");--> statement-breakpoint
CREATE INDEX "feed_translation_feed_id_idx" ON "chia_feed_translation" USING btree ("feed_id");--> statement-breakpoint
CREATE INDEX "feed_translation_locale_idx" ON "chia_feed_translation" USING btree ("locale");--> statement-breakpoint
CREATE INDEX "feed_translation_title_idx" ON "chia_feed_translation" USING btree ("title");--> statement-breakpoint
CREATE INDEX "feed_translation_embedding_idx" ON "chia_feed_translation" USING hnsw ("embedding" vector_cosine_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "feed_slug_idx" ON "chia_feed" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "feed_user_id_idx" ON "chia_feed" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "feed_type_idx" ON "chia_feed" USING btree ("type");--> statement-breakpoint
CREATE INDEX "feed_published_idx" ON "chia_feed" USING btree ("published");--> statement-breakpoint
CREATE INDEX "feed_default_locale_idx" ON "chia_feed" USING btree ("default_locale");--> statement-breakpoint
CREATE INDEX "feeds_to_tags_feed_id_idx" ON "chia_feeds_to_tags" USING btree ("feed_id");--> statement-breakpoint
CREATE INDEX "feeds_to_tags_tag_id_idx" ON "chia_feeds_to_tags" USING btree ("tag_id");--> statement-breakpoint
CREATE UNIQUE INDEX "tag_translation_tag_locale_idx" ON "chia_tag_translation" USING btree ("tag_id","locale");--> statement-breakpoint
CREATE INDEX "tag_translation_tag_id_idx" ON "chia_tag_translation" USING btree ("tag_id");--> statement-breakpoint
CREATE INDEX "tag_translation_locale_idx" ON "chia_tag_translation" USING btree ("locale");--> statement-breakpoint
CREATE INDEX "tag_translation_name_idx" ON "chia_tag_translation" USING btree ("name");--> statement-breakpoint
CREATE UNIQUE INDEX "tag_slug_idx" ON "chia_tag" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "invitation_organization_id_idx" ON "chia_invitation" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "invitation_email_idx" ON "chia_invitation" USING btree ("email");--> statement-breakpoint
CREATE INDEX "member_organization_id_idx" ON "chia_member" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "member_user_id_idx" ON "chia_member" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "organization_slug_uidx" ON "chia_organization" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX "project_slug_idx" ON "chia_project" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "project_organization_id_idx" ON "chia_project" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "project_name_idx" ON "chia_project" USING btree ("name");--> statement-breakpoint
CREATE INDEX "user_email_idx" ON "chia_user" USING btree ("email");