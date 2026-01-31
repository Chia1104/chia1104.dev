import type { Mock } from "vitest";

export const mockFeeds = [
  {
    id: 1,
    slug: "test-feed-1",
    title: "Test Feed 1",
    description: "Test Description 1",
    published: true,
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-01-01"),
    locale: "en",
  },
  {
    id: 2,
    slug: "test-feed-2",
    title: "Test Feed 2",
    description: "Test Description 2",
    published: true,
    createdAt: new Date("2024-01-02"),
    updatedAt: new Date("2024-01-02"),
    locale: "zh-TW",
  },
];

export const mockFeedsResponse = {
  items: mockFeeds,
  meta: {
    nextCursor: null,
    hasMore: false,
  },
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
export const upsertFeedTranslation: Mock = vi.fn().mockResolvedValue(undefined);
export const upsertContent: Mock = vi.fn().mockResolvedValue(undefined);
export const updateFeed: Mock = vi.fn().mockResolvedValue(mockFeeds[0]);

// Mock functions for @chia/db/repos/feeds/embedding
export const searchFeeds: Mock = vi
  .fn()
  .mockResolvedValue(mockSearchFeedsResult);

// Mock functions for @chia/db/repos/public/feeds
export const getPublicFeedsTotal: Mock = vi.fn().mockResolvedValue(100);

// Helper function to reset all mocks
export const resetAllDbMocks = () => {
  getInfiniteFeedsByUserId.mockClear();
  getInfiniteFeeds.mockClear();
  getFeedBySlug.mockClear();
  getFeedById.mockClear();
  upsertFeedTranslation.mockClear();
  upsertContent.mockClear();
  updateFeed.mockClear();
  searchFeeds.mockClear();
  getPublicFeedsTotal.mockClear();
};
