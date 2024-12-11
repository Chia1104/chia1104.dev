import { z } from "zod";

import type {
  getInfiniteFeedsByUserId,
  getFeedBySlug,
} from "@chia/db/repos/feeds";
import { FeedOrderBy } from "@chia/db/types";
import { baseInfiniteSchema } from "@chia/db/validator/feeds";
import { serviceRequest } from "@chia/utils";
import { numericStringSchema } from "@chia/utils";

import { external_createTRPCRouter, external_procedure } from "../../trpc";

/**
 * @TODO: move to shared
 */
const getFeedsWithMetaSchema = z
  .object({
    limit: numericStringSchema.optional().default("20"),
    nextCursor: numericStringSchema.optional(),
    withContent: z.string().optional().default("false"),
    orderBy: z
      .enum([FeedOrderBy.CreatedAt, FeedOrderBy.UpdatedAt, FeedOrderBy.Id])
      .optional()
      .default(FeedOrderBy.CreatedAt),
  })
  .merge(
    baseInfiniteSchema.omit({
      cursor: true,
      limit: true,
      withContent: true,
      orderBy: true,
    })
  )
  .or(
    z
      .object({
        limit: numericStringSchema.optional().default("20"),
        nextCursor: z.string().optional(),
        withContent: z.string().optional().default("false"),
        orderBy: z
          .enum([FeedOrderBy.Slug, FeedOrderBy.Title])
          .optional()
          .default(FeedOrderBy.Slug),
      })
      .merge(
        baseInfiniteSchema.omit({
          cursor: true,
          limit: true,
          withContent: true,
          orderBy: true,
        })
      )
  );

export const feedsRouter = external_createTRPCRouter({
  getFeedsWithMetaByAdminId: external_procedure
    .input(getFeedsWithMetaSchema)
    .query(async (opts) => {
      return await serviceRequest({
        isInternal: true,
        internal_requestSecret: opts.ctx.internal_requestSecret,
      })
        .get(`admin/public/feeds`, {
          searchParams: {
            limit: opts.input.limit?.toString() ?? "",
            nextCursor: opts.input.nextCursor?.toString() ?? "",
            orderBy: opts.input.orderBy?.toString() ?? "",
            sortOrder: opts.input.sortOrder?.toString() ?? "",
            type: opts.input.type?.toString() ?? "",
          },
        })
        .json<ReturnType<typeof getInfiniteFeedsByUserId>>();
    }),

  getFeedBySlug: external_procedure
    .input(z.object({ slug: z.string() }))
    .query(async (opts) => {
      return await serviceRequest({
        isInternal: true,
        internal_requestSecret: opts.ctx.internal_requestSecret,
      })
        .get(`admin/public/feeds/${opts.input.slug}`)
        .json<ReturnType<typeof getFeedBySlug>>();
    }),
});
