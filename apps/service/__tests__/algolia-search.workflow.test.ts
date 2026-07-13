const { mockDeleteObject, mockSaveObject } = vi.hoisted(() => ({
  mockDeleteObject: vi.fn(),
  mockSaveObject: vi.fn(),
}));

vi.mock("@chia/api/algolia", () => ({
  client: {
    deleteObject: mockDeleteObject,
    saveObject: mockSaveObject,
  },
}));

vi.mock("workflow", () => ({
  fetch: globalThis.fetch,
}));

import {
  deleteFeedFromAlgoliaWorkflow,
  saveFeedToAlgoliaWorkflow,
} from "../src/workflows/algolia-search.workflow";

const feedRequest = {
  feedID: 1,
  objectID: 10,
  type: "post" as const,
  locale: "zh-TW" as const,
  slug: "test-post",
  title: "Test post",
  content: "Body",
  description: "Description",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

describe("Algolia feed workflows", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDeleteObject.mockResolvedValue({});
    mockSaveObject.mockResolvedValue({});
  });

  it("should remove an Algolia object when a feed is disabled", async () => {
    await saveFeedToAlgoliaWorkflow({
      ...feedRequest,
      enabled: false,
    });

    expect(mockDeleteObject).toHaveBeenCalledWith(
      expect.objectContaining({
        objectID: "10",
      })
    );
    expect(mockSaveObject).not.toHaveBeenCalled();
  });

  it("should save searchable metadata when a feed is enabled", async () => {
    await saveFeedToAlgoliaWorkflow({
      ...feedRequest,
      enabled: true,
    });

    expect(mockSaveObject).toHaveBeenCalledWith(
      expect.objectContaining({
        body: expect.objectContaining({
          type: "post",
          slug: "test-post",
          version: "2026.07.13",
        }),
      })
    );
  });

  it("should remove every translation after feed deletion", async () => {
    await deleteFeedFromAlgoliaWorkflow({
      objectIDs: [10, 11],
    });

    expect(mockDeleteObject).toHaveBeenCalledTimes(2);
    expect(mockDeleteObject).toHaveBeenCalledWith(
      expect.objectContaining({ objectID: "10" })
    );
    expect(mockDeleteObject).toHaveBeenCalledWith(
      expect.objectContaining({ objectID: "11" })
    );
  });
});
