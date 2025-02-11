CREATE TABLE "chia_passkey" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text,
	"public_key" text NOT NULL,
	"user_id" text NOT NULL,
	"credential_i_d" text NOT NULL,
	"counter" integer NOT NULL,
	"device_type" text NOT NULL,
	"backed_up" boolean NOT NULL,
	"transports" text,
	"created_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "chia_passkey" ADD CONSTRAINT "chia_passkey_user_id_chia_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."chia_user"("id") ON DELETE no action ON UPDATE no action;