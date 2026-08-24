-- drizzle-kit 1.0.0-rc.4 emits the table moves without creating the target schema.
CREATE SCHEMA "agent";--> statement-breakpoint
ALTER TABLE "chia_agent_run" RENAME TO "run";--> statement-breakpoint
ALTER TABLE "chia_agent_session_entry" RENAME TO "session_entry";--> statement-breakpoint
ALTER TABLE "chia_agent_session" RENAME TO "session";--> statement-breakpoint
ALTER TABLE "chia_agent_tool_approval" RENAME TO "tool_approval";--> statement-breakpoint
ALTER TABLE "chia_writing_agent_draft" RENAME TO "writing_draft";--> statement-breakpoint
ALTER TABLE "chia_writing_agent_session" RENAME TO "writing_session";--> statement-breakpoint
ALTER TABLE "run" SET SCHEMA "agent";
--> statement-breakpoint
ALTER TABLE "session_entry" SET SCHEMA "agent";
--> statement-breakpoint
ALTER TABLE "session" SET SCHEMA "agent";
--> statement-breakpoint
ALTER TABLE "tool_approval" SET SCHEMA "agent";
--> statement-breakpoint
ALTER TABLE "writing_draft" SET SCHEMA "agent";
--> statement-breakpoint
ALTER TABLE "writing_session" SET SCHEMA "agent";
