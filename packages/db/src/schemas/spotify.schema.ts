import type { InferSelectModel } from "drizzle-orm";
import { sql } from "drizzle-orm";
import { boolean, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

import { timestamps } from "../libs/common.schema.ts";

import { pgTable } from "./table.ts";
import { user } from "./user.schema.ts";

export const spotifyCredential = pgTable(
  "spotify_credential",
  {
    userId: text("user_id")
      .primaryKey()
      .references(() => user.id, { onDelete: "cascade" }),
    spotifyUserId: text("spotify_user_id").notNull(),
    spotifyDisplayName: text("spotify_display_name"),
    spotifyImageUrl: text("spotify_image_url"),
    accessToken: text("access_token").notNull(),
    refreshToken: text("refresh_token").notNull(),
    accessTokenExpiresAt: timestamp("access_token_expires_at").notNull(),
    scope: text("scope").notNull(),
    isActive: boolean("is_active").default(false).notNull(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("spotify_credential_spotify_user_id_idx").on(
      table.spotifyUserId
    ),
    uniqueIndex("spotify_credential_active_idx")
      .on(table.isActive)
      .where(sql`${table.isActive} = true`),
  ]
);

export type SpotifyCredential = InferSelectModel<typeof spotifyCredential>;
