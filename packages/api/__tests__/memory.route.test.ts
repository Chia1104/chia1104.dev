import { call } from "@orpc/server";
import { vi } from "vitest";

import type { Session } from "@chia/auth/types";
import type { DB } from "@chia/db/client";
import type { UpdateAgentMemoryDTO } from "@chia/db/repos/agent/memory";
import type { AgentMemory } from "@chia/db/schema";
import { omitUndefined } from "@chia/utils/object";

import type * as memoryRouteModule from "../orpc/routes/memory.route";
import type { BaseOSContext } from "../orpc/utils";

const { repo } = vi.hoisted(() => ({
  repo: {
    listAgentMemories: vi.fn(),
    getAgentMemory: vi.fn(),
    updateAgentMemory: vi.fn(),
    softDeleteAgentMemory: vi.fn(),
  },
}));

vi.mock("@chia/db/repos/agent/memory", () => repo);

const ADMIN_ID = "admin-user";

const sessionOf = (id: string, role: string): Session =>
  /* SAFETY: This fixture implements the Session members exercised by this case. */ ({
    session: { id: "s1", userId: id },
    user: { id, role },
  }) as Session;

const contextOf = (
  session: Session | null,
  extra: Partial<BaseOSContext> = {}
): BaseOSContext =>
  /* SAFETY: This fixture implements the BaseOSContext members exercised by this case. */ ({
    headers: new Headers(),
    clientIP: "127.0.0.1",
    config: { rateLimit: { windowMs: 60_000, limit: 100 } },
    db: {},
    session,
    ...extra,
  }) as BaseOSContext;

const admin = (extra?: Partial<BaseOSContext>) =>
  contextOf(sessionOf(ADMIN_ID, "admin"), extra);
const member = () => contextOf(sessionOf("someone-else", "user"));

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
    vi.stubEnv("SKIP_ENV_VALIDATION", "true");
    vi.stubEnv("ENV", "test");
    vi.stubEnv("LOCAL_ADMIN_ID", ADMIN_ID);
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

  it("refuses every route to a signed-in non-admin", async () => {
    await expect(
      call(routes.listMemoriesRoute, {}, { context: member() })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      call(routes.getMemoryRoute, { id: 7 }, { context: member() })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      call(routes.approveLessonRoute, { id: 7 }, { context: member() })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(repo.listAgentMemories).not.toHaveBeenCalled();
  });

  it("lists with the cursor normalised and reads one live memory", async () => {
    await call(
      routes.listMemoriesRoute,
      { kind: "fact", query: "pg" },
      { context: admin() }
    );
    expect(repo.listAgentMemories).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ kind: "fact", query: "pg", cursor: null })
    );

    const detail = await call(
      routes.getMemoryRoute,
      { id: 7 },
      { context: admin() }
    );
    expect(detail.memory).toMatchObject({ id: 7, content: expect.any(String) });

    repo.getAgentMemory.mockResolvedValueOnce(row({ deletedAt: new Date() }));
    await expect(
      call(routes.getMemoryRoute, { id: 7 }, { context: admin() })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("re-indexes after an update, a removal and an approval", async () => {
    const onMemoryChanged = vi.fn(async () => undefined);
    const context = admin({ hooks: { onMemoryChanged } });

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

  it("only approves lessons", async () => {
    repo.getAgentMemory.mockResolvedValueOnce(row({ kind: "fact" }));
    await expect(
      call(routes.approveLessonRoute, { id: 7 }, { context: admin() })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(repo.updateAgentMemory).not.toHaveBeenCalled();
  });

  it("starts consolidation through the port, and says so when there is none", async () => {
    await expect(
      call(
        routes.consolidateMemoryRoute,
        { sessionId: "session-1" },
        { context: admin() }
      )
    ).rejects.toMatchObject({ code: "SERVICE_UNAVAILABLE" });

    const consolidate = vi.fn(async () => ({ runId: "run-1" }));
    const started = await call(
      routes.consolidateMemoryRoute,
      { sessionId: "session-1" },
      { context: admin({ memory: { consolidate } }) }
    );
    expect(started).toEqual({ runId: "run-1" });
    expect(consolidate).toHaveBeenCalledWith(
      { adminId: ADMIN_ID, userId: ADMIN_ID },
      { sessionId: "session-1" }
    );
  });
});
