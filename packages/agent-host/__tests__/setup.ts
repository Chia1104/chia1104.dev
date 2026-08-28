vi.stubEnv("SKIP_ENV_VALIDATION", "1");
vi.stubEnv("NODE_ENV", "test");

vi.mock("@chia/db/repos/feeds", async () => {
  const mocks = await import("./__mocks__/db.mock");
  return {
    getInfiniteFeedsByUserId: mocks.getInfiniteFeedsByUserId,
    getInfiniteFeeds: mocks.getInfiniteFeeds,
    getFeedBySlug: mocks.getFeedBySlug,
    getFeedById: mocks.getFeedById,
    getFeedForIndexing: mocks.getFeedForIndexing,
    getPublicFeedSummariesByIds: mocks.getPublicFeedSummariesByIds,
    getFeedIdByTranslationId: mocks.getFeedIdByTranslationId,
    getFeedRefsByTranslationIds: mocks.getFeedRefsByTranslationIds,
    upsertFeedTranslation: mocks.upsertFeedTranslation,
    upsertContent: mocks.upsertContent,
    updateFeed: mocks.updateFeed,
    softDeleteFeed: mocks.softDeleteFeed,
    deleteFeed: mocks.deleteFeed,
    restoreFeed: mocks.restoreFeed,
  };
});

vi.mock("@chia/db/repos/feeds/search", async () => {
  const mocks = await import("./__mocks__/db.mock");
  return { getRelatedFeeds: mocks.getRelatedFeeds };
});
