import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { auth } from "@chia/auth";
import { APIError } from "@chia/auth/types";
import {
  setApiKeyProjectId,
  getInfiniteApiKeysByProjectId,
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
      z
        .object({
          projectId: z.number(),
        })
        .merge(createAPIKeySchema)
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

      await setApiKeyProjectId(opts.ctx.db, {
        apiKey: data.id,
        projectId: opts.input.projectId,
      });

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
});
