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
import {
  MediaImageRole,
  dominantColorOf,
  removeMediaImage,
  storeMediaImage,
} from "./image.service";
import type { MediaEntryView } from "./media.contract";

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
  backdropUrl: row.backdrop ? `${STORAGE_BASE_URL}/${row.backdrop}` : null,
  color: row.color,
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

    // An image that cannot be copied leaves the entry without it rather than refusing the log.
    const copy = async (role: MediaImageRole, url: string | null) => {
      if (!url) return null;
      try {
        return await storeMediaImage(source, sourceId, role, url, opts.signal);
      } catch (error) {
        logger.warn(
          { err: error, source, sourceId, role },
          "Media image copy failed"
        );
        return null;
      }
    };
    const [poster, backdrop] = await Promise.all([
      copy(MediaImageRole.Poster, snapshot.posterUrl),
      copy(MediaImageRole.Backdrop, snapshot.backdropUrl),
    ]);

    let color = snapshot.color;
    if (!color && poster) {
      try {
        color = await dominantColorOf(poster.body);
      } catch (error) {
        logger.warn(
          { err: error, source, sourceId },
          "Media colour extraction failed"
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
      poster: poster?.key ?? null,
      backdrop: backdrop?.key ?? null,
      color,
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
    for (const key of [row.poster, row.backdrop]) {
      if (!key) continue;
      try {
        await removeMediaImage(key);
      } catch (error) {
        logger.warn({ err: error, key }, "Media image removal failed");
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
