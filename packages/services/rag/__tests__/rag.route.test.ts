import { call } from "@orpc/server";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  vi,
} from "vitest";

import { ResourceIndexRunScope, ResourceIndexRunStatus } from "@chia/db/schema";
import { contextOf } from "@chia/test/context";
import { stubTestEnv } from "@chia/test/env";
import { it as orpcIt } from "@chia/test/orpc";
import { ADMIN_ID, sessionOf } from "@chia/test/session";
import { createWorkflowControlClient } from "@chia/workflow-control/client";
import { WorkflowRunStatus } from "@chia/workflow-control/contract";

import type { BaseOSContext } from "../../shared/context";
import type * as ragRouteModule from "../rag.route";
import { ResourceType } from "../resource-types";

const { repo } = vi.hoisted(() => ({
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

const workflowClient = createWorkflowControlClient({
  url: "http://workflow.test",
  token: "test",
  fetch: () => Promise.reject(new Error("unmocked workflow command")),
});
const workflow = {
  startResourceIndex: vi.spyOn(workflowClient, "startResourceIndex"),
  startFeedIndex: vi.spyOn(workflowClient, "startFeedIndex"),
  startResourceReindex: vi.spyOn(workflowClient, "startResourceReindex"),
  cancelRun: vi.spyOn(workflowClient, "cancelRun"),
  getRun: vi.spyOn(workflowClient, "getRun"),
};

const it = orpcIt.extend("context", ({ session }) =>
  contextOf<BaseOSContext>(session, { workflow: workflowClient })
);

const RUN_ROW = {
  id: 11,
  externalRunId: "wrun_1",
  scope: ResourceIndexRunScope.Resource,
  sourceType: ResourceType.FeedTranslation,
  sourceId: 1,
  feedId: null,
  status: ResourceIndexRunStatus.Running,
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

type RagRoutes = typeof ragRouteModule;
let routes: RagRoutes;

describe("rag routes", () => {
  beforeAll(async () => {
    stubTestEnv({
      SKIP_ENV_VALIDATION: "true",
      ENV: "test",
      LOCAL_ADMIN_ID: ADMIN_ID,
      EMBEDDING_PROVIDER: "openai",
    });

    routes = await import("../rag.route");
  });

  afterAll(() => {
    vi.unstubAllEnvs();
  });

  beforeEach(() => {
    repo.getRagOverview.mockResolvedValue({
      counts: { total: 6, current: 2, stale: 2, missing: 2 },
      bySourceType: [
        {
          sourceType: ResourceType.FeedTranslation,
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
    it("starts the run, then records it as the operator's", async ({
      context,
    }) => {
      workflow.startResourceIndex.mockResolvedValue("wrun_1");
      repo.claimResourceIndexRun.mockResolvedValue({
        run: RUN_ROW,
        reused: false,
      });
      repo.markResourceIndexRunStarted.mockResolvedValue(RUN_ROW);

      const handle = await call(
        routes.indexResourceRoute,
        { sourceType: ResourceType.FeedTranslation, sourceId: 1 },
        { context }
      );

      expect(handle).toMatchObject({
        runId: "wrun_1",
        recordId: 11,
        reused: false,
      });
      expect(workflow.startResourceIndex).toHaveBeenCalledWith({
        sourceType: ResourceType.FeedTranslation,
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

    it("hands back an in-flight run instead of starting a second one", async ({
      context,
    }) => {
      repo.getActiveResourceIndexRun.mockResolvedValue(RUN_ROW);
      workflow.getRun.mockResolvedValue({
        type: "run",
        exists: true,
        status: WorkflowRunStatus.Running,
      });

      const handle = await call(
        routes.indexResourceRoute,
        { sourceType: ResourceType.FeedTranslation, sourceId: 1 },
        { context }
      );

      expect(handle).toMatchObject({ runId: "wrun_1", reused: true });
      expect(workflow.startResourceIndex).not.toHaveBeenCalled();
    });

    it("finalizes a listed row whose run has completed", async ({
      context,
    }) => {
      repo.listResourceIndexRuns.mockResolvedValue({
        items: [RUN_ROW],
        nextCursor: null,
      });
      workflow.getRun.mockResolvedValue({
        type: "run",
        exists: true,
        status: WorkflowRunStatus.Completed,
        output: { chunks: 3 },
      });
      repo.finalizeResourceIndexRun.mockResolvedValue({
        ...RUN_ROW,
        status: ResourceIndexRunStatus.Completed,
        result: { chunks: 3 },
      });

      const page = await call(routes.listIndexRunsRoute, {}, { context });

      expect(repo.finalizeResourceIndexRun).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          id: 11,
          status: ResourceIndexRunStatus.Completed,
          result: { chunks: 3 },
        })
      );
      expect(page.items[0]).toMatchObject({
        runId: "wrun_1",
        status: ResourceIndexRunStatus.Completed,
      });
    });

    it("still serves the reads, which never touch the client", async ({
      context,
    }) => {
      const overview = await call(routes.getRagOverviewRoute, undefined, {
        context,
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
    it("answers the confirmation numbers from the database, port or no port", async ({
      context,
    }) => {
      const preview = await call(routes.previewReindexAllRoute, undefined, {
        context,
      });

      expect(preview.targets).toBe(42);
      expect(preview.counts.total).toBe(6);
      expect(preview.needingEmbedding).toBe(4);
    });
  });

  describe("authorization", () => {
    describe("signed-in non-admin", () => {
      it.override("session", () => sessionOf("someone-else", "user"));

      it("rejects a trigger with FORBIDDEN", async ({ context }) => {
        await expect(
          call(
            routes.indexResourceRoute,
            { sourceType: ResourceType.FeedTranslation, sourceId: 1 },
            { context }
          )
        ).rejects.toMatchObject({ code: "FORBIDDEN" });
      });
    });

    it("rejects an anonymous trigger with UNAUTHORIZED", async () => {
      await expect(
        call(
          routes.indexResourceRoute,
          { sourceType: ResourceType.FeedTranslation, sourceId: 1 },
          {
            context: contextOf<BaseOSContext>(null, {
              workflow: workflowClient,
            }),
          }
        )
      ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    });

    it("rejects an unregistered source type at the boundary", async ({
      context,
    }) => {
      await expect(
        call(
          routes.indexResourceRoute,
          { sourceType: "not_a_resource", sourceId: 1 },
          { context }
        )
      ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    });
  });

  /**
   * `resource_chunk` stores body text with no ownership column, and these queries include
   * unpublished and deleted rows. Sign-up is open, so a session-only guard would hand the
   * whole corpus to anyone.
   */
  describe("reads are admin-only, not merely signed-in", () => {
    describe("signed-in non-admin", () => {
      it.override("session", () => sessionOf("someone-else", "user"));

      it("rejects overview", async ({ context }) => {
        await expect(
          call(routes.getRagOverviewRoute, undefined, { context })
        ).rejects.toMatchObject({ code: "FORBIDDEN" });
      });

      it("rejects reindex:all:preview", async ({ context }) => {
        await expect(
          call(routes.previewReindexAllRoute, undefined, { context })
        ).rejects.toMatchObject({ code: "FORBIDDEN" });
      });

      it("rejects chunks:list", async ({ context }) => {
        await expect(
          call(routes.listRagChunksRoute, {}, { context })
        ).rejects.toMatchObject({ code: "FORBIDDEN" });
      });

      it("rejects chunk:get", async ({ context }) => {
        await expect(
          call(routes.getRagChunkRoute, { chunkId: 1 }, { context })
        ).rejects.toMatchObject({ code: "FORBIDDEN" });
      });

      it("rejects resource:status", async ({ context }) => {
        await expect(
          call(
            routes.getResourceIndexStatusRoute,
            { sourceType: ResourceType.FeedTranslation, sourceId: 1 },
            { context }
          )
        ).rejects.toMatchObject({ code: "FORBIDDEN" });
      });
    });

    it("still serves the configured admin", async ({ context }) => {
      const status = await call(
        routes.getResourceIndexStatusRoute,
        { sourceType: ResourceType.FeedTranslation, sourceId: 1 },
        { context }
      );

      expect(status.counts.total).toBe(0);
      expect(status.activeRunId).toBeNull();
    });
  });
});
