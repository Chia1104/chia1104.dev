import { toApiKeyPermissions } from "@chia/auth/apikey";
import { APIError } from "@chia/auth/types";
import { getInfiniteApiKeys } from "@chia/db/repos/apikey";
import { tryCatch } from "@chia/utils/error-helper";

import { adminGuard } from "../guards/admin.guard";
import { contractOS } from "../utils";

export const createAPIKeyRoute = contractOS.apikey.create
  .use(adminGuard())
  .handler(async (opts) => {
    if (!opts.context.auth) {
      throw opts.errors.UNAUTHORIZED();
    }

    // Server-side call: with request headers better-auth treats `permissions` as a client
    // property and refuses it. `adminGuard()` already proved the session; ownership is `userId`.
    const { data, error } = await tryCatch(
      opts.context.auth.api.createApiKey({
        body: {
          name: opts.input.name,
          userId: opts.context.session?.user.id,
          permissions: toApiKeyPermissions(opts.input.scopes),
        },
      })
    );

    if (error) {
      console.log(error);
      if (error instanceof APIError) {
        switch (error.statusCode) {
          case 401:
            throw opts.errors.UNAUTHORIZED();
          case 403:
            throw opts.errors.FORBIDDEN();
          case 404:
            throw opts.errors.NOT_FOUND();
        }
      }
      throw opts.errors.INTERNAL_SERVER_ERROR();
    }

    return data;
  });

export const getAllApiKeysWithMetaRoute = contractOS.apikey.list
  .use(adminGuard())
  .handler(async (opts) => {
    const { data, error } = await tryCatch(
      getInfiniteApiKeys(opts.context.db, opts.input ?? {})
    );

    if (error) {
      if (error instanceof APIError) {
        switch (error.statusCode) {
          case 401:
            throw opts.errors.UNAUTHORIZED();
          case 403:
            throw opts.errors.FORBIDDEN();
          case 404:
            throw opts.errors.NOT_FOUND();
        }
        throw opts.errors.INTERNAL_SERVER_ERROR();
      }
      throw opts.errors.INTERNAL_SERVER_ERROR();
    }

    return data;
  });

export const revokeApiKeyRoute = contractOS.apikey.revoke
  .use(adminGuard())
  .handler(async (opts) => {
    if (!opts.context.auth) {
      throw opts.errors.UNAUTHORIZED();
    }

    const { data, error } = await tryCatch(
      opts.context.auth.api.updateApiKey({
        headers: opts.context.headers,
        body: {
          keyId: opts.input,
          enabled: false,
        },
      })
    );

    if (error) {
      if (error instanceof APIError) {
        switch (error.statusCode) {
          case 401:
            throw opts.errors.UNAUTHORIZED();
          case 403:
            throw opts.errors.FORBIDDEN();
          case 404:
            throw opts.errors.NOT_FOUND();
        }
        throw opts.errors.INTERNAL_SERVER_ERROR();
      }
      throw opts.errors.INTERNAL_SERVER_ERROR();
    }

    return data;
  });

export const deleteApiKeyRoute = contractOS.apikey.delete
  .use(adminGuard())
  .handler(async (opts) => {
    if (!opts.context.auth) {
      throw opts.errors.UNAUTHORIZED();
    }

    const { data, error } = await tryCatch(
      opts.context.auth.api.deleteApiKey({
        headers: opts.context.headers,
        body: {
          keyId: opts.input,
        },
      })
    );
    if (error) {
      if (error instanceof APIError) {
        switch (error.statusCode) {
          case 401:
            throw opts.errors.UNAUTHORIZED();
          case 403:
            throw opts.errors.FORBIDDEN();
          case 404:
            throw opts.errors.NOT_FOUND();
        }
      }
      throw opts.errors.INTERNAL_SERVER_ERROR();
    }

    return data;
  });

export const updateApiKeyRoute = contractOS.apikey.update
  .use(adminGuard())
  .handler(async (opts) => {
    if (!opts.context.auth) {
      throw opts.errors.UNAUTHORIZED();
    }

    // Same server-side shape as `create`; better-auth still checks the key belongs to `userId`.
    const { data, error } = await tryCatch(
      opts.context.auth.api.updateApiKey({
        body: {
          keyId: opts.input.keyId,
          userId: opts.context.session?.user.id,
          name: opts.input.name,
          permissions: opts.input.scopes
            ? toApiKeyPermissions(opts.input.scopes)
            : undefined,
        },
      })
    );

    if (error) {
      if (error instanceof APIError) {
        switch (error.statusCode) {
          case 401:
            throw opts.errors.UNAUTHORIZED();
          case 403:
            throw opts.errors.FORBIDDEN();
          case 404:
            throw opts.errors.NOT_FOUND();
        }
      }
      throw opts.errors.INTERNAL_SERVER_ERROR();
    }

    return data;
  });
