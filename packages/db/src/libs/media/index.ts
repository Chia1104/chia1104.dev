import { and, desc, eq, sql } from "drizzle-orm";

import type { DB } from "../../client.ts";
import { mediaEntries } from "../../schemas/schema.ts";
import type { MediaEntry } from "../../schemas/schema.ts";
import type { MediaKind, MediaSource, MediaStatus } from "../../types.ts";
import type { MediaTranslations } from "../validator/media.ts";

export interface ListMediaEntriesDTO {
  kind?: MediaKind;
  status?: MediaStatus;
  favorite?: boolean;
  limit?: number;
}

/**
 * Newest activity first: the day a work was finished, else the day it was started, else when the
 * row was added. One person's log is bounded, so `limit` is a display cap, not a page.
 */
export const listMediaEntries = async (
  db: DB,
  dto: ListMediaEntriesDTO = {}
): Promise<MediaEntry[]> => {
  const query = db
    .select()
    .from(mediaEntries)
    .where(
      and(
        dto.kind ? eq(mediaEntries.kind, dto.kind) : undefined,
        dto.status ? eq(mediaEntries.status, dto.status) : undefined,
        dto.favorite === undefined
          ? undefined
          : eq(mediaEntries.favorite, dto.favorite)
      )
    )
    .orderBy(
      desc(
        sql`coalesce(${mediaEntries.finishedOn}, ${mediaEntries.startedOn}, ${mediaEntries.createdAt}::date)`
      ),
      desc(mediaEntries.id)
    );
  return dto.limit === undefined ? await query : await query.limit(dto.limit);
};

export const getMediaEntry = async (
  db: DB,
  id: number
): Promise<MediaEntry | undefined> =>
  await db.query.mediaEntries.findFirst({ where: { id } });

export const getMediaEntryBySlug = async (
  db: DB,
  slug: string
): Promise<MediaEntry | undefined> =>
  await db.query.mediaEntries.findFirst({ where: { slug } });

export const getMediaEntryBySource = async (
  db: DB,
  source: MediaSource,
  sourceId: string
): Promise<MediaEntry | undefined> =>
  await db.query.mediaEntries.findFirst({ where: { source, sourceId } });

/** What the owner sets; everything else on a row is the catalogue snapshot. */
export interface MediaEntryLog {
  status: MediaStatus;
  rating: number | null;
  favorite: boolean;
  startedOn: string | null;
  finishedOn: string | null;
}

/** How much a game has been played. Typed by hand, or read from Steam when the row names an app. */
export interface MediaPlayStats {
  playtimeMinutes: number | null;
  achievementsUnlocked: number | null;
  achievementsTotal: number | null;
  lastPlayedAt: Date | null;
}

export interface InsertMediaEntryDTO
  extends MediaEntryLog, Partial<MediaPlayStats> {
  slug: string;
  steamAppId: number | null;
  kind: MediaKind;
  source: MediaSource;
  sourceId: string;
  sourceUrl: string | null;
  translations: MediaTranslations;
  originalTitle: string | null;
  releaseYear: number | null;
  poster: string | null;
  backdrop: string | null;
  color: string | null;
}

export const createMediaEntry = async (
  db: DB,
  input: InsertMediaEntryDTO
): Promise<MediaEntry> => {
  const [row] = await db.insert(mediaEntries).values(input).returning();
  if (!row) throw new Error("Media entry was not inserted.");
  return row;
};

export interface UpdateMediaEntryDTO
  extends MediaEntryLog, Omit<MediaPlayStats, "lastPlayedAt"> {
  translations: MediaTranslations;
  originalTitle: string | null;
  releaseYear: number | null;
  color: string | null;
  steamAppId: number | null;
}

/** Replaces every editable column. Returns the row, or undefined when there is none. */
export const updateMediaEntry = async (
  db: DB,
  id: number,
  patch: UpdateMediaEntryDTO
): Promise<MediaEntry | undefined> => {
  const [row] = await db
    .update(mediaEntries)
    .set(patch)
    .where(eq(mediaEntries.id, id))
    .returning();
  return row;
};

/** Overwrites the play stats alone; a sync must not touch what the owner typed elsewhere. */
export const updateMediaPlayStats = async (
  db: DB,
  id: number,
  stats: MediaPlayStats
): Promise<MediaEntry | undefined> => {
  const [row] = await db
    .update(mediaEntries)
    .set(stats)
    .where(eq(mediaEntries.id, id))
    .returning();
  return row;
};

/** Returns the deleted row so its images can be removed from storage. */
export const deleteMediaEntry = async (
  db: DB,
  id: number
): Promise<MediaEntry | undefined> => {
  const [row] = await db
    .delete(mediaEntries)
    .where(eq(mediaEntries.id, id))
    .returning();
  return row;
};
