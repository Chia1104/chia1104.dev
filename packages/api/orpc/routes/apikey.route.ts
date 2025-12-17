import { auth } from "@chia/auth";
import { APIError } from "@chia/auth/types";
import { setApiKeyProjectId, getInfiniteApiKeys } from "@chia/db/repos/apikey";
import { tryCatch } from "@chia/utils/try-catch";

import { adminGuard } from "../guards/admin.guard";
import { contractOS } from "../utils";

export const createAPIKeyRoute = contractOS.apikey.create
  .use(adminGuard())
  .handler(async (opts) => {
    const { data, error } = await tryCatch(
      auth.api.createApiKey({
        body: {
          rateLimitEnabled: false,
          ...opts.input,
          userId: opts.context.session.user.id,
        },
        headers: opts.context.headers,
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

    if (opts.input.projectId) {
      await setApiKeyProjectId(opts.context.db, {
        apiKey: data.id,
        projectId: opts.input.projectId,
      });
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
    const { data, error } = await tryCatch(
      auth.api.updateApiKey({
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
    const { data, error } = await tryCatch(
      auth.api.deleteApiKey({
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
    const { data, error } = await tryCatch(
      auth.api.updateApiKey({
        headers: opts.context.headers,
        body: opts.input,
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
