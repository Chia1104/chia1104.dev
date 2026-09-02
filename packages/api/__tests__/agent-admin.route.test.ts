import { call } from "@orpc/server";
import { afterAll, beforeAll, beforeEach, vi } from "vitest";

import { AppError } from "@chia/service-kit/errors";
import { stubTestEnv } from "@chia/test/env";
import {
  ADMIN_ID,
  contextOf,
  describe,
  expect,
  it as orpcIt,
  sessionOf,
} from "@chia/test/orpc";

import type { AgentKindAdmin } from "../orpc/contracts/agent-admin.contract";
import type * as adminRouteModule from "../orpc/routes/agent-admin.route";
import type { AgentFactory } from "../orpc/services/agent.factory";
import type { AgentAdminService } from "../orpc/services/agent/admin";
import type { BaseOSContext } from "../orpc/utils";

const kind: AgentKindAdmin = {
  kind: "writing",
  label: "Writing",
  description: "Drafts posts.",
  minTier: 4,
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
  getQuota: vi.fn(),
  updateQuota: vi.fn(),
  usageWeek: vi.fn(),
  usageOfUser: vi.fn(),
} satisfies AgentAdminService;

const factory = {
  kinds: ["writing"],
  minTierOf: vi.fn(() => undefined),
  load: vi.fn(() => Promise.resolve(undefined)),
  create: vi.fn(() => Promise.resolve(undefined)),
  createAdmin: vi.fn(() => Promise.resolve(service)),
  createUsage: vi.fn(() => Promise.reject(new Error("unused"))),
} satisfies AgentFactory;

const it = orpcIt.extend("context", ({ session }) =>
  contextOf<BaseOSContext>(session, { agentFactory: factory })
);

type AdminRoutes = typeof adminRouteModule;
let routes: AdminRoutes;

describe("agent admin routes", () => {
  beforeAll(async () => {
    stubTestEnv({
      SKIP_ENV_VALIDATION: "true",
      ENV: "test",
      LOCAL_ADMIN_ID: ADMIN_ID,
    });
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

  describe("signed-in non-admin", () => {
    it.override("session", () => sessionOf("someone-else", "user"));

    it("refuses every route", async ({ context }) => {
      await expect(
        call(routes.listAgentKindsAdminRoute, undefined, { context })
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
      await expect(
        call(
          routes.updateAgentKindAdminRoute,
          { kind: "writing", config: {} },
          { context }
        )
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
      await expect(
        call(routes.listAgentTasksAdminRoute, undefined, { context })
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
      await expect(
        call(
          routes.updateAgentTaskAdminRoute,
          { id: "session.title", model: null },
          { context }
        )
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
      await expect(
        call(routes.listAgentTaskModelsAdminRoute, undefined, { context })
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
      await expect(
        call(routes.getAgentQuotaAdminRoute, undefined, { context })
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
      await expect(
        call(
          routes.updateAgentQuotaAdminRoute,
          { weeklyLimitUsd: 0 },
          { context }
        )
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
      await expect(
        call(routes.getAgentUsageWeekAdminRoute, undefined, { context })
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
      await expect(
        call(routes.getAgentUserUsageAdminRoute, { userId: "u1" }, { context })
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
      expect(service.listKinds).not.toHaveBeenCalled();
      expect(service.updateKind).not.toHaveBeenCalled();
      expect(service.updateQuota).not.toHaveBeenCalled();
      expect(service.usageWeek).not.toHaveBeenCalled();
      expect(service.usageOfUser).not.toHaveBeenCalled();
    });
  });

  it("reads a user's usage through the port with the id as given", async ({
    context,
  }) => {
    const standing = {
      period: {
        start: "2026-08-31T00:00:00.000Z",
        end: "2026-09-07T00:00:00.000Z",
        timeZone: "UTC",
      },
      weeklyLimitUsd: 0.3,
      houseUsd: 0.12,
      turns: 4,
      allTimeUsd: 1.5,
      sessions: 3,
    };
    service.usageOfUser.mockResolvedValueOnce(standing);
    const result = await call(
      routes.getAgentUserUsageAdminRoute,
      { userId: "u1" },
      { context }
    );
    expect(result).toEqual(standing);
    expect(service.usageOfUser).toHaveBeenCalledWith(
      expect.objectContaining({ adminId: ADMIN_ID }),
      { userId: "u1" }
    );
  });

  it("rejects a negative quota before the port sees it", async ({
    context,
  }) => {
    await expect(
      call(
        routes.updateAgentQuotaAdminRoute,
        { weeklyLimitUsd: -1 },
        { context }
      )
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(service.updateQuota).not.toHaveBeenCalled();
  });

  it("answers SERVICE_UNAVAILABLE when the process has no agent factory", async ({
    session,
  }) => {
    await expect(
      call(routes.listAgentKindsAdminRoute, undefined, {
        context: contextOf<BaseOSContext>(session, {
          agentFactory: undefined,
        }),
      })
    ).rejects.toMatchObject({ code: "SERVICE_UNAVAILABLE" });
  });

  it("hands the admin's write to the port with the db and the input as given", async ({
    context,
  }) => {
    const result = await call(
      routes.updateAgentKindAdminRoute,
      {
        kind: "writing",
        model: { providerId: "vercel-ai-gateway", modelId: "openai/gpt-5.4" },
        thinkingLevel: null,
        config: { instructions: "Short intros." },
      },
      { context }
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

  it("rejects an override outside the contract before the port sees it", async ({
    context,
  }) => {
    await expect(
      call(
        routes.updateAgentTaskAdminRoute,
        { id: "session.title", params: { temperature: 3 } },
        { context }
      )
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(service.updateTask).not.toHaveBeenCalled();
  });

  it("converts the port's AppError into the matching oRPC code", async ({
    context,
  }) => {
    service.updateTask.mockRejectedValue(
      new AppError("NOT_FOUND", {
        message: 'Agent task "nope" is not registered.',
      })
    );
    await expect(
      call(
        routes.updateAgentTaskAdminRoute,
        { id: "nope", model: null },
        { context }
      )
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});
