import type { Mock } from "vitest";

/** Fixtures match repository output; oRPC procedures validate against the contract. */
const mockTranslation = (locale: "en" | "zh-TW", title: string) => ({
  id: 1,
  feedId: 1,
  locale,
  title,
  excerpt: "Test excerpt",
  description: "Test Description",
  summary: null,
  readTime: null,
  createdAt: new Date("2024-01-01").toISOString(),
  updatedAt: new Date("2024-01-01").toISOString(),
  hasEmbedding: false,
  content: null,
});

const mockFeed = (
  id: number,
  slug: string,
  locale: "en" | "zh-TW",
  title: string
) => ({
  id,
  slug,
  type: "post" as const,
  contentType: "mdx" as const,
  published: true,
  defaultLocale: locale,
  userId: "test-admin-id",
  mainImage: null,
  createdAt: new Date("2024-01-01").toISOString(),
  updatedAt: new Date("2024-01-01").toISOString(),
  deletedAt: null,
  translations: [mockTranslation(locale, title)],
});

export const mockFeeds = [
  mockFeed(1, "test-feed-1", "en", "Test Feed 1"),
  mockFeed(2, "test-feed-2", "zh-TW", "Test Feed 2"),
];

/** `{ items, nextCursor }`, the shape `queryInfiniteFeeds` returns. */
export const mockFeedsResponse = {
  items: mockFeeds,
  nextCursor: null,
};

export const getInfiniteFeedsByUserId: Mock = vi
  .fn()
  .mockResolvedValue(mockFeedsResponse);
export const getInfiniteFeeds: Mock = vi
  .fn()
  .mockResolvedValue(mockFeedsResponse);
export const getFeedBySlug: Mock = vi.fn().mockResolvedValue(mockFeeds[0]);
export const getFeedById: Mock = vi.fn().mockResolvedValue(mockFeeds[0]);
export const getFeedForIndexing: Mock = vi.fn().mockResolvedValue({
  ...mockFeeds[0],
  translations: [],
});
export const getPublicFeedSummariesByIds: Mock = vi
  .fn()
  .mockResolvedValue(mockFeeds);
export const getFeedIdByTranslationId: Mock = vi.fn().mockResolvedValue(1);
export const getFeedRefsByTranslationIds: Mock = vi.fn().mockResolvedValue([]);
export const upsertFeedTranslation: Mock = vi.fn().mockResolvedValue(undefined);
export const upsertContent: Mock = vi
  .fn()
  .mockResolvedValue({ feedTranslationId: 9 });
export const updateFeed: Mock = vi.fn().mockResolvedValue(mockFeeds[0]);
export const softDeleteFeed: Mock = vi.fn().mockResolvedValue(mockFeeds[0]);
export const deleteFeed: Mock = vi.fn().mockResolvedValue(mockFeeds[0]);
export const restoreFeed: Mock = vi.fn().mockResolvedValue(mockFeeds[0]);

export const getRelatedFeeds: Mock = vi.fn().mockResolvedValue([]);

export const searchResources: Mock = vi
  .fn()
  .mockResolvedValue({ mode: "hybrid", items: [] });

export const resetAllDbMocks = () => {
  getInfiniteFeedsByUserId.mockClear();
  getInfiniteFeeds.mockClear();
  getFeedBySlug.mockClear();
  getFeedById.mockClear();
  getFeedForIndexing.mockClear();
  getPublicFeedSummariesByIds.mockClear();
  getFeedIdByTranslationId.mockClear();
  getFeedRefsByTranslationIds.mockClear();
  upsertFeedTranslation.mockClear();
  upsertContent.mockClear();
  updateFeed.mockClear();
  softDeleteFeed.mockClear();
  deleteFeed.mockClear();
  restoreFeed.mockClear();
  getRelatedFeeds.mockClear();
  searchResources.mockClear();
};
