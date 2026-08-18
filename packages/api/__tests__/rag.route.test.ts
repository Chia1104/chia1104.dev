import { call } from "@orpc/server";
import { vi } from "vitest";

import type { Session } from "@chia/auth/types";

import type * as ragRouteModule from "../orpc/routes/rag.route";
import type { BaseOSContext } from "../orpc/utils";

const { repo } = vi.hoisted(() => ({
  repo: {
    getRagOverview: vi.fn(),
    getEmbeddingKeyDistribution: vi.fn(),
    countChunksNeedingEmbedding: vi.fn(),
    getResourceIndexStatus: vi.fn(),
    getChunkDetail: vi.fn(),
    listChunks: vi.fn(),
    getActiveResourceIndexRun: vi.fn(),
    countFeedTranslations: vi.fn(),
  },
}));

vi.mock("@chia/db/repos/feeds", () => ({
  countFeedTranslations: repo.countFeedTranslations,
}));

vi.mock("@chia/db/repos/resources/stats", () => ({
  getRagOverview: repo.getRagOverview,
  getEmbeddingKeyDistribution: repo.getEmbeddingKeyDistribution,
  countChunksNeedingEmbedding: repo.countChunksNeedingEmbedding,
  getResourceIndexStatus: repo.getResourceIndexStatus,
  getChunkDetail: repo.getChunkDetail,
  listChunks: repo.listChunks,
}));

vi.mock("@chia/db/repos/resources/index-run", () => ({
  getActiveResourceIndexRun: repo.getActiveResourceIndexRun,
}));

const ADMIN_ID = "admin-user";

/** Minimal session, shaped as `adminPolicy` reads it. */
const sessionOf = (id: string, role: string): Session =>
  /* SAFETY: This fixture implements the Session members exercised by this case. */ ({
    session: { id: "s1", userId: id },
    user: { id, role },
  }) as Session;

/**
 * Context with a pre-resolved session, the form an in-process caller supplies, so the
 * guards run their real policies without a better-auth round trip. `kv` is absent, which
 * makes `rateLimitGuard` fail open — the budget is not what these tests are about.
 */
const contextOf = (session: Session | null): BaseOSContext =>
  /* SAFETY: This fixture implements the BaseOSContext members exercised by this case. */ ({
    /* SAFETY: This fixture provides only the BaseOSContext fields exercised by these routes. */
    headers: new Headers(),
    clientIP: "127.0.0.1",
    config: { rateLimit: { windowMs: 60_000, limit: 100 } },
    db: {},
    session,
  }) as BaseOSContext;

const admin = () => contextOf(sessionOf(ADMIN_ID, "admin"));
const member = () => contextOf(sessionOf("someone-else", "user"));

// imported dynamically in `beforeAll`, after the env stubs `getAdminId` reads
type RagRoutes = typeof ragRouteModule;
let routes: RagRoutes;

describe("rag routes", () => {
  beforeAll(async () => {
    vi.stubEnv("SKIP_ENV_VALIDATION", "true");
    // `getAdminId` reads a per-environment variable; `ENV` pins which one.
    vi.stubEnv("ENV", "test");
    vi.stubEnv("LOCAL_ADMIN_ID", ADMIN_ID);
    vi.stubEnv("EMBEDDING_PROVIDER", "openai");

    routes = await import("../orpc/routes/rag.route");
  });

  afterAll(() => {
    vi.unstubAllEnvs();
  });

  beforeEach(() => {
    repo.getRagOverview.mockResolvedValue({
      counts: { total: 6, current: 2, stale: 2, missing: 2 },
      bySourceType: [
        {
          sourceType: "feed_translation",
          counts: { total: 6, current: 2, stale: 2, missing: 2 },
        },
      ],
      byLocale: [],
      byKind: [],
      byVisibility: [],
    });
    repo.getEmbeddingKeyDistribution.mockResolvedValue([]);
    repo.countChunksNeedingEmbedding.mockResolvedValue(4);
    repo.getResourceIndexStatus.mockResolvedValue({
      counts: { total: 0, current: 0, stale: 0, missing: 0 },
      chunks: [],
    });
    repo.getActiveResourceIndexRun.mockResolvedValue(null);
    repo.countFeedTranslations.mockResolvedValue(42);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("context without an indexing port", () => {
    it("fails the trigger with SERVICE_UNAVAILABLE rather than a silent no-op", async () => {
      await expect(
        call(
          routes.indexResourceRoute,
          { sourceType: "feed_translation", sourceId: 1 },
          { context: admin() }
        )
      ).rejects.toMatchObject({ code: "SERVICE_UNAVAILABLE" });
    });

    it("fails runs:list too, since reconciling needs the workflow runtime", async () => {
      await expect(
        call(routes.listIndexRunsRoute, {}, { context: admin() })
      ).rejects.toMatchObject({ code: "SERVICE_UNAVAILABLE" });
    });

    it("still serves the reads, which never touch the port", async () => {
      const overview = await call(routes.getRagOverviewRoute, undefined, {
        context: admin(),
      });

      expect(overview.counts).toEqual({
        total: 6,
        current: 2,
        stale: 2,
        missing: 2,
      });
      expect(overview.needingEmbedding).toBe(4);
      expect(overview.model).toBe("text-embedding-3-small");
      expect(overview.indexVersion).toBeTruthy();
    });
  });

  describe("reindex:all:preview", () => {
    it("answers the confirmation numbers from the database, port or no port", async () => {
      const preview = await call(routes.previewReindexAllRoute, undefined, {
        context: admin(),
      });

      expect(preview.targets).toBe(42);
      expect(preview.counts.total).toBe(6);
      expect(preview.needingEmbedding).toBe(4);
    });
  });

  describe("authorization", () => {
    it("rejects a non-admin trigger with FORBIDDEN", async () => {
      await expect(
        call(
          routes.indexResourceRoute,
          { sourceType: "feed_translation", sourceId: 1 },
          { context: member() }
        )
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
    });

    it("rejects an anonymous trigger with UNAUTHORIZED", async () => {
      await expect(
        call(
          routes.indexResourceRoute,
          { sourceType: "feed_translation", sourceId: 1 },
          { context: contextOf(null) }
        )
      ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    });

    it("rejects an unregistered source type at the boundary", async () => {
      await expect(
        call(
          routes.indexResourceRoute,
          { sourceType: "not_a_resource", sourceId: 1 },
          { context: admin() }
        )
      ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    });
  });

  /**
   * `resource_chunk` stores the body text of every indexed resource and carries no
   * ownership column, and these queries deliberately include unpublished and deleted rows.
   * Sign-up is open, so a session-only guard would hand the whole corpus to anyone.
   */
  describe("reads are admin-only, not merely signed-in", () => {
    it("rejects a signed-in non-admin on overview", async () => {
      await expect(
        call(routes.getRagOverviewRoute, undefined, { context: member() })
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
    });

    it("rejects a signed-in non-admin on reindex:all:preview", async () => {
      await expect(
        call(routes.previewReindexAllRoute, undefined, { context: member() })
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
    });

    it("rejects a signed-in non-admin on chunks:list", async () => {
      await expect(
        call(routes.listRagChunksRoute, {}, { context: member() })
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
    });

    it("rejects a signed-in non-admin on chunk:get", async () => {
      await expect(
        call(routes.getRagChunkRoute, { chunkId: 1 }, { context: member() })
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
    });

    it("rejects a signed-in non-admin on resource:status", async () => {
      await expect(
        call(
          routes.getResourceIndexStatusRoute,
          { sourceType: "feed_translation", sourceId: 1 },
          { context: member() }
        )
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
    });

    it("still serves the configured admin", async () => {
      const status = await call(
        routes.getResourceIndexStatusRoute,
        { sourceType: "feed_translation", sourceId: 1 },
        { context: admin() }
      );

      expect(status.counts.total).toBe(0);
      expect(status.activeRunId).toBeNull();
    });
  });
});
