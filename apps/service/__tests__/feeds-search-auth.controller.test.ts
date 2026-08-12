const { mockGetSession } = vi.hoisted(() => ({
  mockGetSession: vi.fn(),
}));

// Deliberately NOT using the pass-through guard mocks — this test exists because the
// session requirement on `GET /feeds/search` was dropped when the route moved from Hono
// to oRPC. It asserts the requirement is back.
vi.mock("@chia/auth", () => ({
  createAuth: () => ({ api: { getSession: mockGetSession } }),
}));

import { app } from "../src/server";

import * as dbMocks from "./__mocks__/db.mock";

const session = (role: string) => ({
  session: { id: "s1", userId: "u1" },
  user: { id: "u1", role },
});

const search = (query: string) => app.request(`/api/v1/feeds/search?${query}`);

describe("feeds.search authentication", () => {
  beforeEach(() => {
    dbMocks.resetAllDbMocks();
    mockGetSession.mockReset();
  });

  it("rejects an anonymous request even for the default hybrid model", async () => {
    mockGetSession.mockResolvedValue(null);

    const res = await search("keyword=kubernetes");

    expect(res.status).toBe(401);
  });

  it("rejects an anonymous request over the RPC surface too", async () => {
    mockGetSession.mockResolvedValue(null);

    const res = await app.request("/api/v1/rpc/content/feeds/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ json: { keyword: "kubernetes" } }),
    });

    expect(res.status).toBe(401);
  });

  it("allows a non-root session for the lexical-only model", async () => {
    mockGetSession.mockResolvedValue(session("admin"));

    const res = await search("keyword=kubernetes&model=bm25");

    expect(res.status).toBe(200);
  });

  it.each(["hybrid", "semantic"])(
    "requires Role.Root for %s, which spends embedding credentials",
    async (model) => {
      mockGetSession.mockResolvedValue(session("admin"));

      const res = await search(`keyword=kubernetes&model=${model}`);

      expect(res.status).toBe(403);
    }
  );

  it("rejects a model that is not a supported mode", async () => {
    mockGetSession.mockResolvedValue(session("root"));

    const res = await search("keyword=kubernetes&model=text-embedding-3-small");

    expect(res.status).toBe(400);
  });
});
