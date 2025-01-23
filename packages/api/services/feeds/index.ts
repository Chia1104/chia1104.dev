import type { z } from "zod";

import type {
  getInfiniteFeedsByUserId,
  getFeedBySlug as TgetFeedBySlug,
  getFeedMetaById as TgetFeedMetaById,
} from "@chia/db/repos/feeds";
import { serviceRequest } from "@chia/utils";

import { withInternalRequest } from "../utils";
import type { getFeedsWithMetaSchema } from "../validators";

export type GetFeedsWithMetaDTO = z.infer<typeof getFeedsWithMetaSchema>;

export type FeedsWithMetaDBSource = Awaited<
  ReturnType<typeof getInfiniteFeedsByUserId>
>;

export type FeedItemDBSource = Pick<FeedsWithMetaDBSource, "items">["items"][0];

export type FeedExtraDBSource = Omit<FeedsWithMetaDBSource, "items">;

export type FeedItem = Omit<FeedItemDBSource, "updatedAt" | "createdAt"> & {
  updatedAt: string;
  createdAt: string;
};

export type FeedWithMeta = { items: FeedItem[] } & FeedExtraDBSource;

export type FeedDetailDBSource = Required<
  Awaited<ReturnType<typeof TgetFeedBySlug>>
>;

export type FeedDetail = FeedDetailDBSource;

export type FeedMetaResult = Awaited<ReturnType<typeof TgetFeedMetaById>>;

export const getFeedsWithMetaByAdminId = withInternalRequest<
  FeedWithMeta,
  GetFeedsWithMetaDTO
>(async (internal_requestSecret, dto, options) => {
  return await serviceRequest({
    isInternal: true,
    internal_requestSecret,
  })
    .get(`admin/public/feeds`, {
      ...options,
      searchParams: {
        limit: dto.limit?.toString() ?? "",
        nextCursor: dto.nextCursor?.toString() ?? "",
        orderBy: dto.orderBy?.toString() ?? "",
        sortOrder: dto.sortOrder?.toString() ?? "",
        type: dto.type?.toString() ?? "",
        published: dto.published?.toString() ?? "",
      },
    })
    .json<FeedWithMeta>();
});

export const getFeedBySlug = withInternalRequest<FeedDetail, { slug: string }>(
  async (internal_requestSecret, { slug }, options) => {
    return await serviceRequest({
      isInternal: true,
      internal_requestSecret,
    })
      .get(`admin/public/feeds/${slug}`, options)
      .json<FeedDetail>();
  }
);

export const getMeta = withInternalRequest<{ total: number }>(
  async (internal_requestSecret, _dto, options) => {
    return await serviceRequest({
      isInternal: true,
      internal_requestSecret,
    })
      .get(`admin/public/feeds:meta`, options)
      .json<{ total: number }>();
  }
);

export const getFeedMetaById = withInternalRequest<
  FeedMetaResult | null,
  { id: string }
>(async (internal_requestSecret, { id }, options) => {
  return await serviceRequest({
    isInternal: true,
    internal_requestSecret,
  })
    .get(`admin/public/feeds:meta/${id}`, options)
    .json<FeedMetaResult | null>();
});
