const { mockGetSession } = vi.hoisted(() => ({
  mockGetSession: vi.fn(),
}));

// Deliberately NOT using the pass-through guard mocks — this test exists because the
// session requirement on the model-selectable search was once dropped in a migration.
// It asserts the requirement is still there.
vi.mock("@chia/auth", () => ({
  createAuth: () => ({ api: { getSession: mockGetSession } }),
}));

import { app } from "../src/server";

import * as dbMocks from "./__mocks__/db.mock";

const session = (role: string) => ({
  session: { id: "s1", userId: "u1" },
  user: { id: "u1", role },
});

// The colon in the procedure key is percent-encoded because this URL is hand-built; an
// oRPC client encodes it for you.
const search = (input: Record<string, unknown>) =>
  app.request("/api/v1/rpc/feeds/search%3Aadvanced", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ json: input }),
  });

describe("feeds.search:advanced authentication", () => {
  beforeEach(() => {
    dbMocks.resetAllDbMocks();
    mockGetSession.mockReset();
  });

  it("rejects an anonymous request even for the default hybrid model", async () => {
    mockGetSession.mockResolvedValue(null);

    const res = await search({ keyword: "kubernetes" });

    expect(res.status).toBe(401);
  });

  it("allows a non-root session for the lexical-only model", async () => {
    mockGetSession.mockResolvedValue(session("admin"));

    const res = await search({ keyword: "kubernetes", model: "bm25" });

    expect(res.status).toBe(200);
  });

  /**
   * Omitting `model` is not the lexical path: the contract defaults it to `hybrid`, which
   * embeds the query. The guard must therefore still demand root.
   */
  it("requires Role.Root when the model is omitted", async () => {
    mockGetSession.mockResolvedValue(session("admin"));

    const res = await search({ keyword: "kubernetes" });

    expect(res.status).toBe(403);
  });

  it.each(["hybrid", "semantic"])(
    "requires Role.Root for %s, which spends embedding credentials",
    async (model) => {
      mockGetSession.mockResolvedValue(session("admin"));

      const res = await search({ keyword: "kubernetes", model });

      expect(res.status).toBe(403);
    }
  );

  it("rejects a model that is not a supported mode", async () => {
    mockGetSession.mockResolvedValue(session("root"));

    const res = await search({
      keyword: "kubernetes",
      model: "text-embedding-3-small",
    });

    expect(res.status).toBe(400);
  });
});
