import { app } from "../src/server";

import * as dbMocks from "./__mocks__/db.mock";
import * as guardMocks from "./__mocks__/guards.mock";

/**
 * `content.feeds.list` is reachable two ways, and each delivers its input differently:
 *
 * - over RPC, `apps/www` sends real JSON (`published: true`, `limit: 10`)
 * - over REST at the legacy `GET /api/v1/admin/public/feeds`, every value is a string
 *
 * Both have to be accepted by the one input schema. Getting this wrong is what produced
 * a 400 on the www feed pages after the route was migrated.
 */
describe("content.feeds.list across both surfaces", () => {
  beforeEach(() => {
    guardMocks.resetAllGuardMocks();
    dbMocks.resetAllDbMocks();
  });

  it("accepts JSON booleans and numbers over RPC", async () => {
    const res = await app.request("/api/v1/rpc/content/feeds/list", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        json: {
          limit: 10,
          type: "all",
          published: true,
          orderBy: "createdAt",
          sortOrder: "desc",
          withContent: false,
          locale: "zh-TW",
        },
      }),
    });

    expect(res.status).toBe(200);

    const body = (await res.json()) as { json: { items: unknown[] } };
    expect(body.json.items).toHaveLength(2);
  });

  it("accepts query strings over the legacy REST URL", async () => {
    const res = await app.request(
      "/api/v1/admin/public/feeds?limit=10&type=all&published=true&orderBy=createdAt&sortOrder=desc&withContent=false&locale=zh-TW"
    );

    expect(res.status).toBe(200);

    const body = (await res.json()) as { items: unknown[] };
    expect(body.items).toHaveLength(2);
  });

  it("passes the parsed flags through to the repository", async () => {
    await app.request("/api/v1/admin/public/feeds?limit=10&withContent=false");

    expect(dbMocks.getInfiniteFeedsByUserId).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ limit: 10, withContent: false })
    );
  });

  describe("public scope is fixed by the handler, not the caller", () => {
    it("ignores a caller-supplied published=false and still lists only published feeds", async () => {
      await app.request(
        "/api/v1/admin/public/feeds?limit=10&published=false&type=all"
      );

      expect(dbMocks.getInfiniteFeedsByUserId).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          whereAnd: { published: true },
          userId: expect.any(String),
        })
      );
    });

    it("scopes details-by-slug to the admin's published feeds", async () => {
      await app.request("/api/v1/admin/public/feeds/test-feed-1");

      expect(dbMocks.getFeedBySlug).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          slug: "test-feed-1",
          published: true,
          userId: expect.any(String),
        })
      );
    });

    it("scopes details-by-id to the admin's published feeds", async () => {
      await app.request("/api/v1/admin/public/feeds:id/1");

      expect(dbMocks.getFeedById).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          feedId: 1,
          published: true,
          userId: expect.any(String),
        })
      );
    });

    // `public-list` is the browser's surface: reachable without the project API key,
    // because that key authenticates www → service and cannot be shipped to a browser.
    // Its scope must therefore be just as tightly fixed as the API-key-guarded `list`.
    it("serves public-list without an API key, still scoped to published feeds", async () => {
      const res = await app.request("/api/v1/feeds/public?limit=10&type=all");

      expect(res.status).toBe(200);
      expect(dbMocks.getInfiniteFeedsByUserId).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          whereAnd: { published: true },
          userId: expect.any(String),
        })
      );
    });

    it("ignores a caller-supplied published=false on public-list too", async () => {
      await app.request("/api/v1/feeds/public?limit=10&published=false");

      expect(dbMocks.getInfiniteFeedsByUserId).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ whereAnd: { published: true } })
      );
    });
  });

  it("serves the related feeds and search procedures over their legacy URLs", async () => {
    dbMocks.getRelatedFeeds.mockResolvedValue([]);

    const related = await app.request(
      "/api/v1/admin/public/feeds/test-feed/related?locale=zh-TW&limit=3"
    );
    expect(related.status).toBe(200);

    const total = await app.request("/api/v1/admin/public/feeds:meta");
    expect(total.status).toBe(200);
    expect(await total.json()).toEqual({ total: 100 });
  });
});
