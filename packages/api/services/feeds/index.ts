import type { z } from "zod";

import type { Locale } from "@chia/db";
import type {
  getInfiniteFeedsByUserId,
  getFeedBySlug as TgetFeedBySlug,
} from "@chia/db/repos/feeds";
import type {
  InsertFeedTranslationDTO,
  UpdateFeedDTO,
  InsertContentDTO,
} from "@chia/db/validator/feeds";
import { serviceRequest } from "@chia/utils/request";

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
        locale: dto.locale?.toString() ?? "",
      },
    })
    .json<FeedWithMeta>();
});

export const getFeedBySlug = withInternalRequest<
  FeedDetail,
  { slug: string; locale?: Locale }
>(async (internal_requestSecret, { slug, locale }, options) => {
  return await serviceRequest({
    isInternal: true,
    internal_requestSecret,
  })
    .get(`admin/public/feeds/${slug}`, {
      ...options,
      searchParams: locale ? { locale } : undefined,
    })
    .json<FeedDetail>();
});

export const getFeedById = withInternalRequest<
  FeedDetail,
  { id: string; locale?: Locale }
>(async (internal_requestSecret, { id, locale }, options) => {
  return await serviceRequest({
    isInternal: true,
    internal_requestSecret,
  })
    .get(`admin/public/feeds:id/${id}`, {
      ...options,
      searchParams: locale ? { locale } : undefined,
    })
    .json<FeedDetail>();
});

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

export const upsertFeedTranslation = withInternalRequest<
  void,
  InsertFeedTranslationDTO & { feedId: number; locale: Locale }
>(async (internal_requestSecret, dto, options) => {
  return await serviceRequest({
    isInternal: true,
    internal_requestSecret,
  })
    .post(`admin/public/feeds:translation`, {
      ...options,
      json: dto,
    })
    .json();
});

export const upsertContent = withInternalRequest<
  void,
  InsertContentDTO & { feedTranslationId: number }
>(async (internal_requestSecret, dto, options) => {
  return await serviceRequest({
    isInternal: true,
    internal_requestSecret,
  })
    .post(`admin/public/feeds:content`, {
      ...options,
      json: dto,
    })
    .json();
});

export const updateFeed = withInternalRequest<
  FeedDetail,
  UpdateFeedDTO & { feedId: number }
>(async (internal_requestSecret, dto, options) => {
  return await serviceRequest({
    isInternal: true,
    internal_requestSecret,
  })
    .post(`admin/public/feeds/${dto.feedId}`, {
      ...options,
      json: dto,
    })
    .json<FeedDetail>();
});
