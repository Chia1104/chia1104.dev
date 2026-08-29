CREATE TABLE "agent"."quota_config" (
	"id" text PRIMARY KEY,
	"weekly_limit_micros" bigint,
	"reset_time_zone" text,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
