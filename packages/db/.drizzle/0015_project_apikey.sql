ALTER TABLE "chia_apikey" ADD COLUMN "project_id" integer;--> statement-breakpoint
ALTER TABLE "chia_apikey" ADD CONSTRAINT "chia_apikey_project_id_chia_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."chia_project"("id") ON DELETE cascade ON UPDATE no action;