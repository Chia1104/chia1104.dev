import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { auth } from "@chia/auth";
import { APIError } from "@chia/auth/types";
import {
  setApiKeyProjectId,
  getInfiniteApiKeysByProjectId,
  getInfiniteApiKeys,
} from "@chia/db/repos/apikey";
import { baseInfiniteSchema } from "@chia/db/validator/apikey";
import { tryCatch } from "@chia/utils/try-catch";

import { adminProcedureWithACL, createTRPCRouter } from "../trpc";
import { createAPIKeySchema } from "../validators";

export const apiKeyRouter = createTRPCRouter({
  /**
   * TODO: use one service to handle project related api key
   */
  createAPIKey: adminProcedureWithACL({
    project: ["update", "apikey.create"],
  })
    .input(
      z.object({
        projectId: z.number().optional(),
        ...createAPIKeySchema.shape,
      })
    )
    .mutation(async (opts) => {
      const { data, error } = await tryCatch(
        auth.api.createApiKey({
          body: {
            rateLimitEnabled: false,
            ...opts.input,
            userId: opts.ctx.session?.session.userId,
          },
          headers: opts.ctx.headers,
        })
      );

      if (error) {
        if (error instanceof APIError) {
          switch (error.statusCode) {
            case 401:
              throw new TRPCError({ code: "UNAUTHORIZED" });
            case 403:
              throw new TRPCError({ code: "FORBIDDEN" });
            case 404:
              throw new TRPCError({ code: "NOT_FOUND" });
          }
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        }
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      }

      if (opts.input.projectId) {
        await setApiKeyProjectId(opts.ctx.db, {
          apiKey: data.id,
          projectId: opts.input.projectId,
        });
      }

      return data;
    }),

  getApiKeys: adminProcedureWithACL({
    project: ["read", "apikey.read"],
  })
    .input(
      z.object({
        ...baseInfiniteSchema.shape,
        projectId: z.number(),
      })
    )
    .query(async (opts) => {
      return await getInfiniteApiKeysByProjectId(opts.ctx.db, {
        ...opts.input,
        projectId: opts.input.projectId,
      });
    }),

  getAllApiKeys: adminProcedureWithACL({
    project: ["read", "apikey.read"],
  }).query(async (opts) => {
    const { data, error } = await tryCatch(
      auth.api.listApiKeys({
        headers: opts.ctx.headers,
      })
    );

    if (error) {
      if (error instanceof APIError) {
        switch (error.statusCode) {
          case 401:
            throw new TRPCError({ code: "UNAUTHORIZED" });
          case 403:
            throw new TRPCError({ code: "FORBIDDEN" });
          case 404:
            throw new TRPCError({ code: "NOT_FOUND" });
        }
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      }
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    }

    return data;
  }),

  getAllApiKeysWithMeta: adminProcedureWithACL({
    project: ["read", "apikey.read"],
  })
    .input(
      z
        .object({
          ...baseInfiniteSchema.shape,
          withProject: z.boolean().optional(),
        })
        .optional()
    )
    .query(async (opts) => {
      const { data, error } = await tryCatch(
        getInfiniteApiKeys(opts.ctx.db, opts.input ?? {})
      );

      if (error) {
        if (error instanceof APIError) {
          switch (error.statusCode) {
            case 401:
              throw new TRPCError({ code: "UNAUTHORIZED" });
            case 403:
              throw new TRPCError({ code: "FORBIDDEN" });
            case 404:
              throw new TRPCError({ code: "NOT_FOUND" });
          }
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        }
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      }

      return data;
    }),

  revokeApiKey: adminProcedureWithACL({
    project: ["update", "apikey.delete"],
  })
    .input(z.string())
    .mutation(async (opts) => {
      const { data, error } = await tryCatch(
        auth.api.updateApiKey({
          headers: opts.ctx.headers,
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
              throw new TRPCError({ code: "UNAUTHORIZED" });
            case 403:
              throw new TRPCError({ code: "FORBIDDEN" });
            case 404:
              throw new TRPCError({ code: "NOT_FOUND" });
          }
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        }
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      }

      return data;
    }),

  deleteApiKey: adminProcedureWithACL({
    project: ["delete", "apikey.delete"],
  })
    .input(z.string())
    .mutation(async (opts) => {
      const { data, error } = await tryCatch(
        auth.api.deleteApiKey({
          headers: opts.ctx.headers,
          body: {
            keyId: opts.input,
          },
        })
      );

      if (error) {
        if (error instanceof APIError) {
          switch (error.statusCode) {
            case 401:
              throw new TRPCError({ code: "UNAUTHORIZED" });
            case 403:
              throw new TRPCError({ code: "FORBIDDEN" });
            case 404:
              throw new TRPCError({ code: "NOT_FOUND" });
          }
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        }
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      }

      return data;
    }),

  updateApiKey: adminProcedureWithACL({
    project: ["update", "apikey.update"],
  })
    .input(
      z.object({
        name: z.string(),
        keyId: z.string(),
      })
    )
    .mutation(async (opts) => {
      const { data, error } = await tryCatch(
        auth.api.updateApiKey({
          headers: opts.ctx.headers,
          body: {
            keyId: opts.input.keyId,
            name: opts.input.name,
          },
        })
      );

      if (error) {
        if (error instanceof APIError) {
          switch (error.statusCode) {
            case 401:
              throw new TRPCError({ code: "UNAUTHORIZED" });
            case 403:
              throw new TRPCError({ code: "FORBIDDEN" });
            case 404:
              throw new TRPCError({ code: "NOT_FOUND" });
          }
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        }
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      }

      return data;
    }),
});
