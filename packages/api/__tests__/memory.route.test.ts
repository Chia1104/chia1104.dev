import { call } from "@orpc/server";
import { afterAll, beforeAll, beforeEach, vi } from "vitest";

import type { DB } from "@chia/db/client";
import type { UpdateAgentMemoryDTO } from "@chia/db/repos/agent/memory";
import type { AgentMemory } from "@chia/db/schema";
import { stubTestEnv } from "@chia/test/env";
import {
  ADMIN_ID,
  contextOf,
  describe,
  expect,
  it,
  sessionOf,
} from "@chia/test/orpc";
import { omitUndefined } from "@chia/utils/object";
import type { WorkflowControlClient } from "@chia/workflow-control/client";

import type * as memoryRouteModule from "../orpc/routes/memory.route";

const { repo } = vi.hoisted(() => ({
  repo: {
    listAgentMemories: vi.fn(),
    getAgentMemory: vi.fn(),
    updateAgentMemory: vi.fn(),
    softDeleteAgentMemory: vi.fn(),
  },
}));

vi.mock("@chia/db/repos/agent/memory", () => repo);

const row = (overrides: Partial<AgentMemory> = {}): AgentMemory => ({
  id: 7,
  kind: "lesson",
  status: "pending",
  title: "Prefer short intros",
  content: "The operator cut every long intro.",
  sourceUrl: null,
  sessionId: "session-1",
  createdAt: new Date("2026-08-01T00:00:00Z"),
  updatedAt: new Date("2026-08-01T00:00:00Z"),
  deletedAt: null,
  ...overrides,
});

type MemoryRoutes = typeof memoryRouteModule;
let routes: MemoryRoutes;

describe("memory routes", () => {
  beforeAll(async () => {
    stubTestEnv({
      SKIP_ENV_VALIDATION: "true",
      ENV: "test",
      LOCAL_ADMIN_ID: ADMIN_ID,
    });
    routes = await import("../orpc/routes/memory.route");
  });

  afterAll(() => {
    vi.unstubAllEnvs();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    repo.listAgentMemories.mockResolvedValue({ items: [], nextCursor: null });
    repo.getAgentMemory.mockResolvedValue(row());
    // the service passes every field, absent ones as `undefined`; the real repo writes only
    // the present ones, and so must the fake
    repo.updateAgentMemory.mockImplementation(
      async (_db: DB, _id: number, patch: UpdateAgentMemoryDTO) =>
        row(omitUndefined(patch))
    );
    repo.softDeleteAgentMemory.mockResolvedValue(true);
  });

  describe("signed-in non-admin", () => {
    it.override("session", () => sessionOf("someone-else", "user"));

    it("refuses every route", async ({ context }) => {
      await expect(
        call(routes.listMemoriesRoute, {}, { context })
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
      await expect(
        call(routes.getMemoryRoute, { id: 7 }, { context })
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
      await expect(
        call(routes.approveLessonRoute, { id: 7 }, { context })
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
      expect(repo.listAgentMemories).not.toHaveBeenCalled();
    });
  });

  it("lists with the cursor normalised and reads one live memory", async ({
    context,
  }) => {
    await call(
      routes.listMemoriesRoute,
      { kind: "fact", query: "pg" },
      { context }
    );
    expect(repo.listAgentMemories).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ kind: "fact", query: "pg", cursor: null })
    );

    const detail = await call(routes.getMemoryRoute, { id: 7 }, { context });
    expect(detail.memory).toMatchObject({ id: 7, content: expect.any(String) });

    repo.getAgentMemory.mockResolvedValueOnce(row({ deletedAt: new Date() }));
    await expect(
      call(routes.getMemoryRoute, { id: 7 }, { context })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("re-indexes after an update, a removal and an approval", async ({
    session,
  }) => {
    const onMemoryChanged = vi.fn(async () => undefined);
    const context = contextOf(session, { hooks: { onMemoryChanged } });

    await call(routes.updateMemoryRoute, { id: 7, title: "x" }, { context });
    await call(routes.removeMemoryRoute, { id: 7 }, { context });
    const approved = await call(
      routes.approveLessonRoute,
      { id: 7 },
      { context }
    );

    expect(approved.memory.status).toBe("active");
    expect(onMemoryChanged.mock.calls).toEqual([[7], [7], [7]]);
  });

  it("only approves lessons", async ({ context }) => {
    repo.getAgentMemory.mockResolvedValueOnce(row({ kind: "fact" }));
    await expect(
      call(routes.approveLessonRoute, { id: 7 }, { context })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(repo.updateAgentMemory).not.toHaveBeenCalled();
  });

  it("starts consolidation through the workflow client", async ({
    session,
  }) => {
    const startMemoryConsolidation = vi
      .fn<WorkflowControlClient["startMemoryConsolidation"]>()
      .mockResolvedValue("run-1");
    const workflow: Partial<WorkflowControlClient> = {
      startMemoryConsolidation,
    };
    const started = await call(
      routes.consolidateMemoryRoute,
      { sessionId: "session-1" },
      {
        context: contextOf(session, {
          /* SAFETY: This fixture implements the client member this route exercises. */
          workflow: workflow as WorkflowControlClient,
        }),
      }
    );
    expect(started).toEqual({ runId: "run-1" });
    expect(startMemoryConsolidation).toHaveBeenCalledWith("session-1");
  });
});
