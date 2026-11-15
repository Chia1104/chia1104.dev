import type { InferSelectModel } from "drizzle-orm";
import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  real,
  serial,
  smallint,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

import { timestamps } from "../libs/common.schema.ts";
import type {
  MediaAchievementTranslations,
  MediaTranslations,
} from "../libs/validator/media.ts";
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

/**
 * One achievement of a game, as Steam defines it and as the owner stands on it. A sync replaces
 * every row of its entry, so a row never outlives the app id it was read for.
 */
export const mediaAchievements = pgTable(
  "media_achievement",
  {
    id: serial("id").primaryKey(),
    mediaEntryId: integer("media_entry_id")
      .notNull()
      .references(() => mediaEntries.id, { onDelete: "cascade" }),
    /** Steam's own name for it; unique within a game. */
    apiName: text("api_name").notNull(),
    /** Shape is `mediaAchievementTranslationsSchema`. */
    translations: jsonb("translations")
      .$type<MediaAchievementTranslations>()
      .notNull(),
    /** On Steam's CDN; the site links it and keeps no copy. */
    iconUrl: text("icon_url").notNull(),
    /** The greyed icon Steam shows before the unlock. */
    lockedIconUrl: text("locked_icon_url").notNull(),
    /** Steam keeps its description back until it is unlocked. */
    hidden: boolean("hidden").notNull(),
    /** Share of the game's players who hold it, 0 to 100; `null` when Steam reports none. */
    globalPercent: real("global_percent"),
    unlocked: boolean("unlocked").notNull(),
    /** `null` while locked, and for an unlock older than Steam's record of the time. */
    unlockedAt: timestamp("unlocked_at", { withTimezone: true, mode: "date" }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("media_achievement_entry_api_name_idx").on(
      table.mediaEntryId,
      table.apiName
    ),
  ]
);

export type MediaEntry = InferSelectModel<typeof mediaEntries>;
export type MediaAchievement = InferSelectModel<typeof mediaAchievements>;
