import { generateApiKey, toApiKeyScopes } from "@chia/auth/apikey";
import {
  createApiKey,
  deleteApiKey,
  getInfiniteApiKeys,
  updateApiKey,
} from "@chia/db/repos/apikey";

import { contractOS } from "../shared/context";
import { adminGuard } from "../shared/guards/admin.guard";

/** Unknown stored scopes are dropped so the wire only carries names the UI knows. */
const withKnownScopes = <T extends { scopes: string[] }>(row: T) => ({
  ...row,
  scopes: toApiKeyScopes(row.scopes),
});

export const createAPIKeyRoute = contractOS.apikey.create
  .use(adminGuard())
  .handler(async (opts) => {
    const { key, keyHash, start } = await generateApiKey();
    const row = await createApiKey(opts.context.db, {
      userId: opts.context.session.user.id,
      name: opts.input.name ?? null,
      scopes: opts.input.scopes,
      keyHash,
      start,
    });
    return { ...withKnownScopes(row), key };
  });

export const getAllApiKeysWithMetaRoute = contractOS.apikey.list
  .use(adminGuard())
  .handler(async (opts) => {
    const page = await getInfiniteApiKeys(opts.context.db, opts.input ?? {});
    return { ...page, items: page.items.map(withKnownScopes) };
  });

export const revokeApiKeyRoute = contractOS.apikey.revoke
  .use(adminGuard())
  .handler(async (opts) => {
    const row = await updateApiKey(opts.context.db, {
      id: opts.input,
      userId: opts.context.session.user.id,
      enabled: false,
    });
    if (!row) throw opts.errors.NOT_FOUND();
    return withKnownScopes(row);
  });

export const deleteApiKeyRoute = contractOS.apikey.delete
  .use(adminGuard())
  .handler(async (opts) => {
    const deleted = await deleteApiKey(opts.context.db, {
      id: opts.input,
      userId: opts.context.session.user.id,
    });
    if (!deleted) throw opts.errors.NOT_FOUND();
  });

export const updateApiKeyRoute = contractOS.apikey.update
  .use(adminGuard())
  .handler(async (opts) => {
    const row = await updateApiKey(opts.context.db, {
      id: opts.input.keyId,
      userId: opts.context.session.user.id,
      name: opts.input.name,
      scopes: opts.input.scopes,
    });
    if (!row) throw opts.errors.NOT_FOUND();
    return withKnownScopes(row);
  });

export const apikeyRouter = contractOS.apikey.router({
  create: createAPIKeyRoute,
  list: getAllApiKeysWithMetaRoute,
  revoke: revokeApiKeyRoute,
  delete: deleteApiKeyRoute,
  update: updateApiKeyRoute,
});
