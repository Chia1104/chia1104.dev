import { call } from "@orpc/server";
import { vi } from "vitest";

import type { Session } from "@chia/auth/types";
import { AppError } from "@chia/service-kit/errors";

import type { AgentKindAdmin } from "../orpc/contracts/agent-admin.contract";
import type * as adminRouteModule from "../orpc/routes/agent-admin.route";
import type { AgentAdminService } from "../orpc/services/agent-admin.service";
import type { BaseOSContext } from "../orpc/utils";

/**
 * The routes are thin: admin-only, then hand the request to the host's port. What is pinned is
 * that the guard is on every route, that a process without the port answers
 * `SERVICE_UNAVAILABLE`, and that the port's `AppError`s reach the client as oRPC codes.
 */

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

const kind: AgentKindAdmin = {
  kind: "writing",
  label: "Writing",
  description: "Drafts posts.",
  minTier: 3,
  defaults: {
    code: {
      providerId: "vercel-ai-gateway",
      modelId: "anthropic/claude-sonnet-5",
      thinkingLevel: "off",
      autoApprove: [],
    },
    override: { model: null, thinkingLevel: null, autoApprove: null },
    effective: {
      providerId: "vercel-ai-gateway",
      modelId: "anthropic/claude-sonnet-5",
      thinkingLevel: "off",
      autoApprove: [],
    },
  },
  config: { schema: {}, defaults: {}, override: {}, effective: {} },
  updatedAt: null,
};

const service = {
  listKinds: vi.fn(),
  updateKind: vi.fn(),
  listTasks: vi.fn(),
  updateTask: vi.fn(),
  listTaskModels: vi.fn(),
} satisfies AgentAdminService;

const admin = (extra?: Partial<BaseOSContext>) =>
  contextOf(sessionOf(ADMIN_ID, "admin"), { agentAdmin: service, ...extra });
const member = () =>
  contextOf(sessionOf("someone-else", "user"), { agentAdmin: service });

type AdminRoutes = typeof adminRouteModule;
let routes: AdminRoutes;

describe("agent admin routes", () => {
  beforeAll(async () => {
    vi.stubEnv("SKIP_ENV_VALIDATION", "true");
    vi.stubEnv("ENV", "test");
    vi.stubEnv("LOCAL_ADMIN_ID", ADMIN_ID);
    routes = await import("../orpc/routes/agent-admin.route");
  });

  afterAll(() => {
    vi.unstubAllEnvs();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    service.listKinds.mockResolvedValue([kind]);
    service.updateKind.mockResolvedValue(kind);
    service.listTasks.mockResolvedValue([]);
    service.listTaskModels.mockResolvedValue([]);
  });

  it("refuses every route to a signed-in non-admin", async () => {
    await expect(
      call(routes.listAgentKindsAdminRoute, undefined, { context: member() })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      call(
        routes.updateAgentKindAdminRoute,
        { kind: "writing", config: {} },
        { context: member() }
      )
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      call(routes.listAgentTasksAdminRoute, undefined, { context: member() })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      call(
        routes.updateAgentTaskAdminRoute,
        { id: "session.title", model: null },
        { context: member() }
      )
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      call(routes.listAgentTaskModelsAdminRoute, undefined, {
        context: member(),
      })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(service.listKinds).not.toHaveBeenCalled();
    expect(service.updateKind).not.toHaveBeenCalled();
  });

  it("answers SERVICE_UNAVAILABLE when the process has no admin port", async () => {
    await expect(
      call(routes.listAgentKindsAdminRoute, undefined, {
        context: admin({ agentAdmin: undefined }),
      })
    ).rejects.toMatchObject({ code: "SERVICE_UNAVAILABLE" });
  });

  it("hands the admin's write to the port with the db and the input as given", async () => {
    const result = await call(
      routes.updateAgentKindAdminRoute,
      {
        kind: "writing",
        model: { providerId: "vercel-ai-gateway", modelId: "openai/gpt-5.4" },
        thinkingLevel: null,
        config: { instructions: "Short intros." },
      },
      { context: admin() }
    );
    expect(result).toEqual(kind);
    expect(service.updateKind).toHaveBeenCalledWith(
      expect.objectContaining({ adminId: ADMIN_ID, db: expect.anything() }),
      {
        kind: "writing",
        model: { providerId: "vercel-ai-gateway", modelId: "openai/gpt-5.4" },
        thinkingLevel: null,
        config: { instructions: "Short intros." },
      }
    );
  });

  it("rejects an override outside the contract before the port sees it", async () => {
    await expect(
      call(
        routes.updateAgentTaskAdminRoute,
        { id: "session.title", params: { temperature: 3 } },
        { context: admin() }
      )
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(service.updateTask).not.toHaveBeenCalled();
  });

  it("converts the port's AppError into the matching oRPC code", async () => {
    service.updateTask.mockRejectedValue(
      new AppError("NOT_FOUND", {
        message: 'Agent task "nope" is not registered.',
      })
    );
    await expect(
      call(
        routes.updateAgentTaskAdminRoute,
        { id: "nope", model: null },
        { context: admin() }
      )
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});
