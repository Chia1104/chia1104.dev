import { call } from "@orpc/server";
import { vi } from "vitest";

import type { Session } from "@chia/auth/types";
import type { WorkflowControlClient } from "@chia/workflow-control/client";

import type * as ragRouteModule from "../orpc/routes/rag.route";
import type { BaseOSContext } from "../orpc/utils";

const { repo, workflow } = vi.hoisted(() => ({
  repo: {
    getRagOverview: vi.fn(),
    getEmbeddingKeyDistribution: vi.fn(),
    countChunksNeedingEmbedding: vi.fn(),
    getResourceIndexStatus: vi.fn(),
    getChunkDetail: vi.fn(),
    listChunks: vi.fn(),
    getActiveResourceIndexRun: vi.fn(),
    claimResourceIndexRun: vi.fn(),
    markResourceIndexRunStarted: vi.fn(),
    listResourceIndexRuns: vi.fn(),
    getResourceIndexRunByExternalId: vi.fn(),
    finalizeResourceIndexRun: vi.fn(),
    countFeedTranslations: vi.fn(),
    countAgentMemories: vi.fn(),
  },
  // Typed per member so the fixture below stays assignable to the client it stands in for.
  workflow: {
    startResourceIndex: vi.fn<WorkflowControlClient["startResourceIndex"]>(),
    startFeedIndex: vi.fn<WorkflowControlClient["startFeedIndex"]>(),
    startResourceReindex:
      vi.fn<WorkflowControlClient["startResourceReindex"]>(),
    cancelRun: vi.fn<WorkflowControlClient["cancelRun"]>(),
    getRun: vi.fn<WorkflowControlClient["getRun"]>(),
  },
}));

vi.mock("@chia/db/repos/feeds", () => ({
  countFeedTranslations: repo.countFeedTranslations,
}));

vi.mock("@chia/db/repos/agent/memory", () => ({
  countAgentMemories: repo.countAgentMemories,
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
  claimResourceIndexRun: repo.claimResourceIndexRun,
  markResourceIndexRunStarted: repo.markResourceIndexRunStarted,
  listResourceIndexRuns: repo.listResourceIndexRuns,
  getResourceIndexRunByExternalId: repo.getResourceIndexRunByExternalId,
  finalizeResourceIndexRun: repo.finalizeResourceIndexRun,
}));

const ADMIN_ID = "admin-user";

/** The mocks seen as the client they stand in for, which is what the context carries. */
const workflowClient: Partial<WorkflowControlClient> = workflow;

/** Minimal session, shaped as `adminPolicy` reads it. */
const sessionOf = (id: string, role: string): Session =>
  /* SAFETY: This fixture implements the Session members exercised by this case. */ ({
    session: { id: "s1", userId: id },
    user: { id, role },
  }) as Session;

/**
 * Context with a pre-resolved session, the form an in-process caller supplies, so the
 * guards run their real policies without a better-auth round trip. `kv` is absent, which
 * makes `rateLimitGuard` fail open — the budget is not what these tests are about. The
 * workflow client is the stub above, so a trigger is observable without a runner.
 */
const contextOf = (session: Session | null): BaseOSContext =>
  /* SAFETY: This fixture implements the BaseOSContext members exercised by this case. */ ({
    /* SAFETY: This fixture provides only the BaseOSContext fields exercised by these routes. */
    headers: new Headers(),
    clientIP: "127.0.0.1",
    config: { rateLimit: { windowMs: 60_000, limit: 100 } },
    db: {},
    workflow: workflowClient,
    session,
  }) as BaseOSContext;

const RUN_ROW = {
  id: 11,
  externalRunId: "wrun_1",
  scope: "resource",
  sourceType: "feed_translation",
  sourceId: 1,
  feedId: null,
  status: "running",
  model: "text-embedding-3-small",
  indexVersion: "v1",
  progress: null,
  result: null,
  error: null,
  triggeredBy: ADMIN_ID,
  startedAt: new Date("2026-08-01T00:00:00Z"),
  endedAt: null,
  createdAt: new Date("2026-08-01T00:00:00Z"),
};

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
    repo.countFeedTranslations.mockResolvedValue(40);
    repo.countAgentMemories.mockResolvedValue(2);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("runs go through the workflow client", () => {
    it("starts the run, then records it as the operator's", async () => {
      workflow.startResourceIndex.mockResolvedValue("wrun_1");
      repo.claimResourceIndexRun.mockResolvedValue({
        run: RUN_ROW,
        reused: false,
      });
      repo.markResourceIndexRunStarted.mockResolvedValue(RUN_ROW);

      const handle = await call(
        routes.indexResourceRoute,
        { sourceType: "feed_translation", sourceId: 1 },
        { context: admin() }
      );

      expect(handle).toMatchObject({
        runId: "wrun_1",
        recordId: 11,
        reused: false,
      });
      expect(workflow.startResourceIndex).toHaveBeenCalledWith({
        sourceType: "feed_translation",
        sourceId: 1,
      });
      expect(repo.claimResourceIndexRun).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          externalRunId: "wrun_1",
          triggeredBy: ADMIN_ID,
        })
      );
    });

    it("hands back an in-flight run instead of starting a second one", async () => {
      repo.getActiveResourceIndexRun.mockResolvedValue(RUN_ROW);
      workflow.getRun.mockResolvedValue({
        type: "run",
        exists: true,
        status: "running",
      });

      const handle = await call(
        routes.indexResourceRoute,
        { sourceType: "feed_translation", sourceId: 1 },
        { context: admin() }
      );

      expect(handle).toMatchObject({ runId: "wrun_1", reused: true });
      expect(workflow.startResourceIndex).not.toHaveBeenCalled();
    });

    it("finalizes a listed row whose run has completed", async () => {
      repo.listResourceIndexRuns.mockResolvedValue({
        items: [RUN_ROW],
        nextCursor: null,
      });
      workflow.getRun.mockResolvedValue({
        type: "run",
        exists: true,
        status: "completed",
        output: { chunks: 3 },
      });
      repo.finalizeResourceIndexRun.mockResolvedValue({
        ...RUN_ROW,
        status: "completed",
        result: { chunks: 3 },
      });

      const page = await call(
        routes.listIndexRunsRoute,
        {},
        { context: admin() }
      );

      expect(repo.finalizeResourceIndexRun).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          id: 11,
          status: "completed",
          result: { chunks: 3 },
        })
      );
      expect(page.items[0]).toMatchObject({
        runId: "wrun_1",
        status: "completed",
      });
    });

    it("still serves the reads, which never touch the client", async () => {
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
