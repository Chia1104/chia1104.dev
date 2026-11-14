import {
  createMediaEntry,
  deleteMediaEntry,
  getMediaEntryBySource,
  listMediaEntries,
  updateMediaEntry,
} from "@chia/db/repos/media";
import type { MediaEntry } from "@chia/db/schema";
import { mediaTranslationsSchema } from "@chia/db/validator/media";
import { logger } from "@chia/observability/logger";
import { STORAGE_BASE_URL, WwwCacheTag } from "@chia/utils/config";

import { contractOS } from "../shared/context";
import { adminGuard } from "../shared/guards/admin.guard";
import { callerGuard } from "../shared/guards/caller.guard";
import { rateLimitGuard } from "../shared/guards/rate-limit.guard";

import {
  MEDIA_KIND_SOURCES,
  resolveMediaSnapshot,
  searchMediaCatalogues,
} from "./catalogue.service";
import type { MediaEntryView } from "./media.contract";
import { removePoster, storePoster } from "./poster.service";

/** Parsing `translations` re-establishes that the stored JSON is the current shape. */
const entryOf = (row: MediaEntry): MediaEntryView => ({
  id: row.id,
  kind: row.kind,
  source: row.source,
  sourceUrl: row.sourceUrl,
  translations: mediaTranslationsSchema.parse(row.translations),
  originalTitle: row.originalTitle,
  releaseYear: row.releaseYear,
  posterUrl: row.poster ? `${STORAGE_BASE_URL}/${row.poster}` : null,
  status: row.status,
  rating: row.rating,
  favorite: row.favorite,
  startedOn: row.startedOn,
  finishedOn: row.finishedOn,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
});

/** The log reads like the site's other public listings, so it shares their budget. */
export const listMediaEntriesRoute = contractOS.media.list
  .use(callerGuard())
  .use(rateLimitGuard("feeds"))
  .handler(async (opts) => ({
    items: (await listMediaEntries(opts.context.db, opts.input)).map(entryOf),
  }));

export const searchMediaRoute = contractOS.media.search
  .use(adminGuard())
  .handler(async (opts) => {
    try {
      return {
        items: await searchMediaCatalogues(
          opts.input.kind,
          opts.input.query,
          opts.signal
        ),
      };
    } catch (error) {
      throw opts.errors.SERVICE_UNAVAILABLE({ cause: error });
    }
  });

// A media write starts no workflow of its own, so each one below revalidates the site itself.
export const createMediaEntryRoute = contractOS.media.create
  .use(adminGuard())
  .handler(async (opts) => {
    const { kind, source, sourceId, ...log } = opts.input;
    const sources: readonly string[] = MEDIA_KIND_SOURCES[kind];
    if (!sources.includes(source)) {
      throw opts.errors.BAD_REQUEST({
        message: `${source} does not list ${kind}`,
      });
    }
    if (await getMediaEntryBySource(opts.context.db, source, sourceId)) {
      throw opts.errors.CONFLICT({ message: "This work is already logged" });
    }

    let snapshot;
    try {
      snapshot = await resolveMediaSnapshot(source, sourceId, opts.signal);
    } catch (error) {
      throw opts.errors.SERVICE_UNAVAILABLE({ cause: error });
    }
    if (!snapshot) {
      throw opts.errors.NOT_FOUND();
    }

    // A cover that cannot be copied leaves the entry without one rather than refusing the log.
    let poster: string | null = null;
    if (snapshot.posterUrl) {
      try {
        poster = await storePoster(
          source,
          sourceId,
          snapshot.posterUrl,
          opts.signal
        );
      } catch (error) {
        logger.warn(
          { err: error, source, sourceId },
          "Media cover copy failed"
        );
      }
    }

    const row = await createMediaEntry(opts.context.db, {
      kind,
      source,
      sourceId,
      sourceUrl: snapshot.sourceUrl,
      translations: snapshot.translations,
      originalTitle: snapshot.originalTitle,
      releaseYear: snapshot.releaseYear,
      poster,
      ...log,
    });
    await opts.context.workflow.startSiteRevalidation(WwwCacheTag.Media);
    return { entry: entryOf(row) };
  });

export const updateMediaEntryRoute = contractOS.media.update
  .use(adminGuard())
  .handler(async (opts) => {
    const { id, ...patch } = opts.input;
    const row = await updateMediaEntry(opts.context.db, id, patch);
    if (!row) {
      throw opts.errors.NOT_FOUND();
    }
    await opts.context.workflow.startSiteRevalidation(WwwCacheTag.Media);
    return { entry: entryOf(row) };
  });

export const removeMediaEntryRoute = contractOS.media.remove
  .use(adminGuard())
  .handler(async (opts) => {
    const row = await deleteMediaEntry(opts.context.db, opts.input.id);
    if (!row) {
      throw opts.errors.NOT_FOUND();
    }
    if (row.poster) {
      try {
        await removePoster(row.poster);
      } catch (error) {
        logger.warn(
          { err: error, key: row.poster },
          "Media cover removal failed"
        );
      }
    }
    await opts.context.workflow.startSiteRevalidation(WwwCacheTag.Media);
    return { id: opts.input.id };
  });

export const mediaRouter = contractOS.media.router({
  list: listMediaEntriesRoute,
  search: searchMediaRoute,
  create: createMediaEntryRoute,
  update: updateMediaEntryRoute,
  remove: removeMediaEntryRoute,
});
