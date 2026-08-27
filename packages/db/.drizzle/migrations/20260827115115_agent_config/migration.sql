CREATE TABLE "agent"."kind_config" (
	"kind" text PRIMARY KEY,
	"provider_id" text,
	"model_id" text,
	"thinking_level" text,
	"auto_approve" jsonb,
	"config" jsonb DEFAULT '{}' NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agent"."task_config" (
	"task_id" text PRIMARY KEY,
	"provider_id" text,
	"model_id" text,
	"system_prompt" text,
	"params" jsonb DEFAULT '{}' NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
