ALTER TABLE "agent"."tool_approval" ADD COLUMN "approval_key" text;--> statement-breakpoint
ALTER TABLE "agent"."tool_approval" ADD COLUMN "consumed_at" timestamp with time zone;--> statement-breakpoint
UPDATE "agent"."tool_approval" SET "approval_key" = "tool_name" || ':' || "tool_call_id";--> statement-breakpoint
UPDATE "agent"."tool_approval" SET "consumed_at" = "decided_at" WHERE "status" = 'approved';--> statement-breakpoint
ALTER TABLE "agent"."tool_approval" ALTER COLUMN "approval_key" SET NOT NULL;
