import type { Mock } from "vitest";

const feed = {
  id: 1,
  slug: "test-feed-1",
  type: "post" as const,
  contentType: "mdx" as const,
  published: true,
  defaultLocale: "en" as const,
  userId: "author-1",
  mainImage: null,
  createdAt: new Date("2024-01-01").toISOString(),
  updatedAt: new Date("2024-01-01").toISOString(),
  deletedAt: null,
  translations: [
    {
      id: 1,
      feedId: 1,
      locale: "en" as const,
      title: "Test Feed",
      excerpt: "Excerpt",
      description: "Description",
      summary: null,
      content: null,
    },
  ],
};

export const getInfiniteFeeds: Mock = vi.fn().mockResolvedValue({
  items: [feed],
  nextCursor: null,
});
export const getFeedBySlug: Mock = vi.fn().mockResolvedValue(feed);
export const getFeedById: Mock = vi.fn().mockResolvedValue(feed);

export const resetAgentContentDbMocks = () => {
  getInfiniteFeeds.mockClear();
  getFeedBySlug.mockClear();
  getFeedById.mockClear();
};
