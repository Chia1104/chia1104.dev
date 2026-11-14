import type { InferSelectModel } from "drizzle-orm";
import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  serial,
  smallint,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

import { timestamps } from "../libs/common.schema.ts";
import type { MediaTranslations } from "../libs/validator/media.ts";
import type { MediaKind, MediaSource, MediaStatus } from "../types.ts";

import { pgTable } from "./table.ts";

/**
 * One film, series, anime or game the site owner logs. The work's facts are a snapshot taken from
 * `source` when the row is added, so the public site never calls a catalogue.
 */
export const mediaEntries = pgTable(
  "media_entry",
  {
    id: serial("id").primaryKey(),
    /** Names the work in its public URL; never changes once the row exists. */
    slug: text("slug").notNull(),
    kind: text("kind").$type<MediaKind>().notNull(),
    source: text("source").$type<MediaSource>().notNull(),
    sourceId: text("source_id").notNull(),
    /** The work's page in the catalogue. */
    sourceUrl: text("source_url"),
    /** Shape is `mediaTranslationsSchema`. */
    translations: jsonb("translations").$type<MediaTranslations>().notNull(),
    originalTitle: text("original_title"),
    releaseYear: integer("release_year"),
    /** Object key of the cover in the site's storage bucket. */
    poster: text("poster"),
    /** Object key of the landscape key art. */
    backdrop: text("backdrop"),
    /** The cover's dominant colour as `#rrggbb`; the site tints itself with it. */
    color: text("color"),
    status: text("status").$type<MediaStatus>().notNull(),
    /** 1 to 10. */
    rating: smallint("rating"),
    favorite: boolean("favorite").notNull().default(false),
    startedOn: date("started_on", { mode: "string" }),
    finishedOn: date("finished_on", { mode: "string" }),
    /** A game's id on Steam; play stats below are read from there when it is set. */
    steamAppId: integer("steam_app_id"),
    playtimeMinutes: integer("playtime_minutes"),
    achievementsUnlocked: integer("achievements_unlocked"),
    achievementsTotal: integer("achievements_total"),
    lastPlayedAt: timestamp("last_played_at", {
      withTimezone: true,
      mode: "date",
    }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("media_entry_source_idx").on(table.source, table.sourceId),
    uniqueIndex("media_entry_slug_idx").on(table.slug),
    index("media_entry_kind_status_idx").on(table.kind, table.status),
  ]
);

export type MediaEntry = InferSelectModel<typeof mediaEntries>;
