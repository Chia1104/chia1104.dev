DROP INDEX "agent_run_external_id_idx";--> statement-breakpoint
CREATE UNIQUE INDEX "agent_run_external_id_idx" ON "chia_agent_run" ("external_run_id");