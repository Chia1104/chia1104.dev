import { call } from "@orpc/server";
import { afterAll, beforeAll, beforeEach, vi } from "vitest";

import type { ResourceIndexRun } from "@chia/db/schema";
import { stubTestEnv } from "@chia/test/env";
import {
  ADMIN_ID,
  contextOf,
  describe,
  expect,
  it as orpcIt,
  sessionOf,
} from "@chia/test/orpc";
import type { WorkflowControlClient } from "@chia/workflow-control/client";

import type * as dashboardRouteModule from "../orpc/routes/dashboard.route";
import type { BaseOSContext } from "../orpc/utils";

const { repos } = vi.hoisted(() => ({
  repos: {
    getUserStats: vi.fn(),
    getFeedStats: vi.fn(),
    listResourceIndexRuns: vi.fn(),
  },
}));

vi.mock("@chia/db/repos/users", () => ({
  getUserStats: repos.getUserStats,
}));
vi.mock("@chia/db/repos/feeds", () => ({ getFeedStats: repos.getFeedStats }));
vi.mock("@chia/db/repos/resources/index-run", () => ({
  listResourceIndexRuns: repos.listResourceIndexRuns,
}));

const completedRun: ResourceIndexRun = {
  id: 3,
  externalRunId: "run-3",
  scope: "all",
  sourceType: null,
  sourceId: null,
  feedId: null,
  status: "completed",
  triggeredBy: ADMIN_ID,
  model: "text-embedding-3-small",
  indexVersion: "v1",
  progress: { done: 4, total: 4, failed: [] },
  result: null,
  error: null,
  startedAt: new Date("2026-08-30T00:00:00Z"),
  endedAt: new Date("2026-08-30T00:01:00Z"),
  createdAt: new Date("2026-08-30T00:00:00Z"),
  updatedAt: new Date("2026-08-30T00:01:00Z"),
};

/* SAFETY: a completed run is never reconciled, so the client is not called. */
const workflow = {} as WorkflowControlClient;

const it = orpcIt.extend("context", ({ session }) =>
  contextOf<BaseOSContext>(session, { workflow })
);

type DashboardRoutes = typeof dashboardRouteModule;
let routes: DashboardRoutes;

describe("dashboard overview route", () => {
  beforeAll(async () => {
    stubTestEnv({
      SKIP_ENV_VALIDATION: "true",
      ENV: "test",
      LOCAL_ADMIN_ID: ADMIN_ID,
    });
    routes = await import("../orpc/routes/dashboard.route");
  });

  afterAll(() => {
    vi.unstubAllEnvs();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    repos.getUserStats.mockResolvedValue({
      total: 12,
      guests: 5,
      newSince: 2,
      banned: 1,
    });
    repos.getFeedStats.mockResolvedValue({ posts: 8, notes: 3, drafts: 2 });
    repos.listResourceIndexRuns.mockResolvedValue({
      items: [completedRun],
      nextCursor: null,
    });
  });

  describe("signed-in non-admin", () => {
    it.override("session", () => sessionOf("someone-else", "user"));

    it("refuses the read", async ({ context }) => {
      await expect(
        call(routes.getDashboardOverviewRoute, undefined, { context })
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
      expect(repos.getUserStats).not.toHaveBeenCalled();
    });
  });

  it("folds the counts and the newest run into one view", async ({
    context,
  }) => {
    const overview = await call(routes.getDashboardOverviewRoute, undefined, {
      context,
    });
    expect(overview.users).toEqual({
      total: 12,
      guests: 5,
      newThisWeek: 2,
      banned: 1,
    });
    expect(overview.content).toEqual({ posts: 8, notes: 3, drafts: 2 });
    expect(overview.latestIndexRun).toMatchObject({
      runId: "run-3",
      status: "completed",
    });
    expect(repos.listResourceIndexRuns).toHaveBeenCalledWith(
      expect.anything(),
      { limit: 1 }
    );
  });

  it("reports no run before the first index run", async ({ context }) => {
    repos.listResourceIndexRuns.mockResolvedValueOnce({
      items: [],
      nextCursor: null,
    });
    const overview = await call(routes.getDashboardOverviewRoute, undefined, {
      context,
    });
    expect(overview.latestIndexRun).toBeNull();
  });
});
