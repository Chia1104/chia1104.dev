CREATE TABLE "chia_spotify_credential" (
	"user_id" text PRIMARY KEY,
	"spotify_user_id" text NOT NULL,
	"spotify_display_name" text,
	"spotify_image_url" text,
	"access_token" text NOT NULL,
	"refresh_token" text NOT NULL,
	"access_token_expires_at" timestamp NOT NULL,
	"scope" text NOT NULL,
	"is_active" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "spotify_credential_spotify_user_id_idx" ON "chia_spotify_credential" ("spotify_user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "spotify_credential_active_idx" ON "chia_spotify_credential" ("is_active") WHERE "is_active" = true;--> statement-breakpoint
ALTER TABLE "chia_spotify_credential" ADD CONSTRAINT "chia_spotify_credential_user_id_chia_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "chia_user"("id") ON DELETE CASCADE;