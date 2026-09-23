import { ApiKeyScope } from "@chia/auth/apikey";
import {
  createTag,
  deleteTag,
  getTagIdBySlug,
  listTags,
  updateTag,
} from "@chia/db/repos/tags";

import { contractOS } from "../shared/context";
import { adminGuard } from "../shared/guards/admin.guard";
import { callerGuard } from "../shared/guards/caller.guard";
import { rateLimitGuard } from "../shared/guards/rate-limit.guard";

/** Listed with the feeds a browser reads, so it shares their budget and key scope. */
const publicReadGuard = callerGuard({ scopes: [ApiKeyScope.FeedsRead] });

export const listTagsRoute = contractOS.tags.list
  .use(publicReadGuard)
  .use(rateLimitGuard("feeds"))
  .handler(async (opts) => ({ items: await listTags(opts.context.db) }));

export const createTagRoute = contractOS.tags.create
  .use(adminGuard())
  .handler(async (opts) => {
    if (await getTagIdBySlug(opts.context.db, opts.input.slug)) {
      throw opts.errors.CONFLICT({
        message: `A tag with slug "${opts.input.slug}" already exists`,
      });
    }
    return { tag: await createTag(opts.context.db, opts.input) };
  });

export const updateTagRoute = contractOS.tags.update
  .use(adminGuard())
  .handler(async (opts) => {
    const { id, ...write } = opts.input;
    const holder = await getTagIdBySlug(opts.context.db, write.slug);
    if (holder !== undefined && holder !== id) {
      throw opts.errors.CONFLICT({
        message: `A tag with slug "${write.slug}" already exists`,
      });
    }
    const tag = await updateTag(opts.context.db, id, write);
    if (!tag) {
      throw opts.errors.NOT_FOUND();
    }
    return { tag };
  });

export const removeTagRoute = contractOS.tags.remove
  .use(adminGuard())
  .handler(async (opts) => {
    if (!(await deleteTag(opts.context.db, opts.input.id))) {
      throw opts.errors.NOT_FOUND();
    }
    return { id: opts.input.id };
  });

export const tagsRouter = contractOS.tags.router({
  list: listTagsRoute,
  create: createTagRoute,
  update: updateTagRoute,
  remove: removeTagRoute,
});
