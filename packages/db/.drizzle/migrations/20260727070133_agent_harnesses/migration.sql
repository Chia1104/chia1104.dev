CREATE TABLE "chia_agent_pending_message" (
	"id" text PRIMARY KEY,
	"session_id" text NOT NULL,
	"kind" text NOT NULL,
	"text" text NOT NULL,
	"consumed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chia_agent_run" (
	"id" text PRIMARY KEY,
	"session_id" text NOT NULL,
	"harness_kind" text NOT NULL,
	"harness_version" integer DEFAULT 1 NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"external_run_id" text NOT NULL,
	"metadata" jsonb DEFAULT '{}' NOT NULL,
	"started_at" timestamp DEFAULT now() NOT NULL,
	"ended_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "chia_agent_session_entry" (
	"seq" bigserial,
	"id" text,
	"session_id" text,
	"parent_id" text,
	"type" text NOT NULL,
	"payload" jsonb NOT NULL,
	"timestamp" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "chia_agent_session_entry_pkey" PRIMARY KEY("session_id","id")
);
--> statement-breakpoint
CREATE TABLE "chia_agent_session" (
	"id" text PRIMARY KEY,
	"user_id" text NOT NULL,
	"kind" text NOT NULL,
	"title" text,
	"provider_id" text,
	"model_id" text,
	"thinking_level" text,
	"active_tool_names" jsonb,
	"auto_approve" jsonb DEFAULT '[]' NOT NULL,
	"runtime_config" jsonb DEFAULT '{}' NOT NULL,
	"config_version" integer DEFAULT 1 NOT NULL,
	"leaf_entry_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "chia_agent_tool_approval" (
	"session_id" text,
	"tool_call_id" text,
	"tool_name" text NOT NULL,
	"args" jsonb,
	"status" text DEFAULT 'pending' NOT NULL,
	"comment" text,
	"decided_by" text,
	"decided_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "chia_agent_tool_approval_pkey" PRIMARY KEY("session_id","tool_call_id")
);
--> statement-breakpoint
CREATE TABLE "chia_writing_agent_draft" (
	"session_id" text,
	"locale" "locale",
	"meta" jsonb DEFAULT '{}' NOT NULL,
	"content" text,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "chia_writing_agent_draft_pkey" PRIMARY KEY("session_id","locale")
);
--> statement-breakpoint
CREATE TABLE "chia_writing_agent_session" (
	"session_id" text PRIMARY KEY,
	"target_feed_id" integer,
	"feed_meta" jsonb DEFAULT '{}' NOT NULL
);
--> statement-breakpoint
CREATE INDEX "agent_pending_message_pending_idx" ON "chia_agent_pending_message" ("session_id","consumed_at");--> statement-breakpoint
CREATE INDEX "agent_run_session_status_idx" ON "chia_agent_run" ("session_id","status");--> statement-breakpoint
CREATE INDEX "agent_run_external_id_idx" ON "chia_agent_run" ("external_run_id");--> statement-breakpoint
CREATE UNIQUE INDEX "agent_run_one_active_per_session_idx" ON "chia_agent_run" ("session_id") WHERE "status" = 'active';--> statement-breakpoint
CREATE INDEX "agent_session_entry_seq_idx" ON "chia_agent_session_entry" ("session_id","seq");--> statement-breakpoint
CREATE INDEX "agent_session_entry_parent_idx" ON "chia_agent_session_entry" ("session_id","parent_id");--> statement-breakpoint
CREATE INDEX "agent_session_entry_type_idx" ON "chia_agent_session_entry" ("session_id","type");--> statement-breakpoint
CREATE INDEX "agent_session_user_id_idx" ON "chia_agent_session" ("user_id");--> statement-breakpoint
CREATE INDEX "agent_session_user_kind_idx" ON "chia_agent_session" ("user_id","kind");--> statement-breakpoint
CREATE INDEX "agent_session_deleted_at_idx" ON "chia_agent_session" ("deleted_at");--> statement-breakpoint
CREATE INDEX "agent_session_updated_at_idx" ON "chia_agent_session" ("updated_at");--> statement-breakpoint
CREATE INDEX "writing_agent_session_target_feed_idx" ON "chia_writing_agent_session" ("target_feed_id");--> statement-breakpoint
ALTER TABLE "chia_agent_pending_message" ADD CONSTRAINT "chia_agent_pending_message_FbnXYYHlwm65_fkey" FOREIGN KEY ("session_id") REFERENCES "chia_agent_session"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "chia_agent_run" ADD CONSTRAINT "chia_agent_run_session_id_chia_agent_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "chia_agent_session"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "chia_agent_session_entry" ADD CONSTRAINT "chia_agent_session_entry_session_id_chia_agent_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "chia_agent_session"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "chia_agent_session" ADD CONSTRAINT "chia_agent_session_user_id_chia_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "chia_user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "chia_agent_tool_approval" ADD CONSTRAINT "chia_agent_tool_approval_session_id_chia_agent_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "chia_agent_session"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "chia_agent_tool_approval" ADD CONSTRAINT "chia_agent_tool_approval_decided_by_chia_user_id_fkey" FOREIGN KEY ("decided_by") REFERENCES "chia_user"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "chia_writing_agent_draft" ADD CONSTRAINT "chia_writing_agent_draft_session_id_chia_agent_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "chia_agent_session"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "chia_writing_agent_session" ADD CONSTRAINT "chia_writing_agent_session_jFq3ARaaLvAT_fkey" FOREIGN KEY ("session_id") REFERENCES "chia_agent_session"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "chia_writing_agent_session" ADD CONSTRAINT "chia_writing_agent_session_target_feed_id_chia_feed_id_fkey" FOREIGN KEY ("target_feed_id") REFERENCES "chia_feed"("id") ON DELETE SET NULL;