-- A keyless public visitor could only ever run the kind default, so these rows recorded a
-- snapshot of that default rather than a choice. Cleared, they follow the current default.
UPDATE "agent"."session"
SET "provider_id" = NULL, "model_id" = NULL
WHERE "kind" = 'public' AND "provider_id" = 'vercel-ai-gateway';
