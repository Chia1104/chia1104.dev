CREATE TABLE "chia_invitation" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"email" text NOT NULL,
	"role" "role" DEFAULT 'user',
	"status" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"inviter_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chia_member" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"user_id" text NOT NULL,
	"role" "role" DEFAULT 'user' NOT NULL,
	"created_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chia_organization" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text,
	"logo" text,
	"created_at" timestamp NOT NULL,
	"metadata" text,
	CONSTRAINT "chia_organization_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "chia_project" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text,
	"logo" text,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"deleted_at" timestamp,
	"metadata" text,
	"organization_id" text NOT NULL,
	CONSTRAINT "chia_project_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
ALTER TABLE "chia_invitation" ADD CONSTRAINT "chia_invitation_organization_id_chia_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."chia_organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chia_invitation" ADD CONSTRAINT "chia_invitation_inviter_id_chia_user_id_fk" FOREIGN KEY ("inviter_id") REFERENCES "public"."chia_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chia_member" ADD CONSTRAINT "chia_member_organization_id_chia_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."chia_organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chia_member" ADD CONSTRAINT "chia_member_user_id_chia_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."chia_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chia_project" ADD CONSTRAINT "chia_project_organization_id_chia_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."chia_organization"("id") ON DELETE cascade ON UPDATE no action;