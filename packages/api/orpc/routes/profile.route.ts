import {
  createProfileEntry,
  getProfileEntry,
  listProfileEntries,
  softDeleteProfileEntry,
  updateProfileEntry,
} from "@chia/db/repos/profile";
import type { ProfileEntry } from "@chia/db/schema";
import { profileEntryContentSchema } from "@chia/db/validator/profile";

import type { ProfileEntryView } from "../contracts/profile.contract";
import { adminGuard } from "../guards/admin.guard";
import { contractOS } from "../utils";

/**
 * Every route is `adminGuard()`, reads included: nothing here is published yet. Rows
 * belong to the configured admin, so that id is both the list scope and the owner of a
 * new row.
 */

/**
 * `kind` and `data` are separate columns; parsing the pair re-establishes that the stored
 * JSON is the current shape for that kind. A row that no longer parses is a backfill to
 * run, not a reader to soften.
 */
const entryOf = (row: ProfileEntry): ProfileEntryView => ({
  id: row.id,
  published: row.published,
  sortOrder: row.sortOrder,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
  ...profileEntryContentSchema.parse({ kind: row.kind, data: row.data }),
});

export const listProfileEntriesRoute = contractOS.profile.list
  .use(adminGuard())
  .handler(async (opts) => {
    const rows = await listProfileEntries(opts.context.db, {
      userId: opts.context.adminId,
      kind: opts.input.kind,
    });
    return { items: rows.map(entryOf) };
  });

export const getProfileEntryRoute = contractOS.profile.get
  .use(adminGuard())
  .handler(async (opts) => {
    const row = await getProfileEntry(opts.context.db, opts.input.id);
    if (!row) {
      throw opts.errors.NOT_FOUND();
    }
    return { entry: entryOf(row) };
  });

export const createProfileEntryRoute = contractOS.profile.create
  .use(adminGuard())
  .handler(async (opts) => {
    const row = await createProfileEntry(opts.context.db, {
      userId: opts.context.adminId,
      kind: opts.input.kind,
      data: opts.input.data,
      published: opts.input.published,
      sortOrder: opts.input.sortOrder,
    });
    return { entry: entryOf(row) };
  });

export const updateProfileEntryRoute = contractOS.profile.update
  .use(adminGuard())
  .handler(async (opts) => {
    const row = await updateProfileEntry(opts.context.db, opts.input.id, {
      kind: opts.input.kind,
      data: opts.input.data,
      published: opts.input.published,
      sortOrder: opts.input.sortOrder,
    });
    if (!row) {
      throw opts.errors.NOT_FOUND();
    }
    return { entry: entryOf(row) };
  });

export const removeProfileEntryRoute = contractOS.profile.remove
  .use(adminGuard())
  .handler(async (opts) => {
    const removed = await softDeleteProfileEntry(
      opts.context.db,
      opts.input.id
    );
    if (!removed) {
      throw opts.errors.NOT_FOUND();
    }
    return { id: opts.input.id };
  });
