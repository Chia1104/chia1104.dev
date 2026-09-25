ALTER TABLE "agent"."tool_approval" ADD COLUMN "run_id" text;--> statement-breakpoint
ALTER TABLE "agent"."tool_approval" DROP COLUMN "consumed_at";--> statement-breakpoint
CREATE INDEX "agent_tool_approval_run_idx" ON "agent"."tool_approval" ("run_id");--> statement-breakpoint
ALTER TABLE "agent"."tool_approval" ADD CONSTRAINT "tool_approval_run_id_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "agent"."run"("id") ON DELETE SET NULL;--> statement-breakpoint
UPDATE "agent"."tool_approval" SET "status" = 'rejected', "comment" = 'Closed when approved calls became resumable; ask the agent again.', "decided_at" = now() WHERE "status" = 'pending';
