import type { Mock } from "vitest";

/**
 * Feed rows shaped like the repository actually returns them.
 *
 * These used to be loose stubs, which was harmless while the Hono routes returned
 * whatever the repository gave them. The oRPC procedures validate their output against
 * the contract, so the fixtures now have to be faithful — that is the point of moving
 * to contract-first.
 */
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

/**
 * `{ items, nextCursor }` — the shape `queryInfiniteFeeds` returns
 * (`packages/db/src/libs/feeds/index.ts`). The previous fixture invented a
 * `meta: { nextCursor, hasMore }` wrapper that production never produced.
 */
export const mockFeedsResponse = {
  items: mockFeeds,
  nextCursor: null,
};

const mockSearchFeedsResult = {
  items: mockFeeds,
  embedding: [0.1, 0.2, 0.3],
};

// Mock functions for @chia/db/repos/feeds
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
export const upsertFeedTranslation: Mock = vi.fn().mockResolvedValue(undefined);
export const upsertContent: Mock = vi.fn().mockResolvedValue(undefined);
export const updateFeed: Mock = vi.fn().mockResolvedValue(mockFeeds[0]);

// Mock functions for @chia/db/repos/feeds/embedding
export const searchFeeds: Mock = vi
  .fn()
  .mockResolvedValue(mockSearchFeedsResult);
export const getRelatedFeeds: Mock = vi.fn().mockResolvedValue([]);

// Mock functions for @chia/db/repos/public/feeds
export const getPublicFeedsTotal: Mock = vi.fn().mockResolvedValue(100);

// Helper function to reset all mocks
export const resetAllDbMocks = () => {
  getInfiniteFeedsByUserId.mockClear();
  getInfiniteFeeds.mockClear();
  getFeedBySlug.mockClear();
  getFeedById.mockClear();
  getFeedForIndexing.mockClear();
  getPublicFeedSummariesByIds.mockClear();
  getFeedIdByTranslationId.mockClear();
  upsertFeedTranslation.mockClear();
  upsertContent.mockClear();
  updateFeed.mockClear();
  searchFeeds.mockClear();
  getRelatedFeeds.mockClear();
  getPublicFeedsTotal.mockClear();
};
