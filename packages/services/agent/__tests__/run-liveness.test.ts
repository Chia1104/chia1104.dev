import { drizzle } from "drizzle-orm/node-postgres";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AgentRunStatus, relations } from "@chia/db/schema";
import {
  createFakeRuns,
  getRun,
  resetWorkflowMocks,
} from "@chia/test/mocks/workflow";

const runs = createFakeRuns();

/**
 * A turn marker is only "running" while the World run that would execute it is alive.
 * A marker on a dead run is closed as failed; a marker on a live run and a young unbound
 * lease are left alone; an old unbound lease is dead.
 */

const repo = vi.hoisted(() => ({
  listRunningAgentRuns: vi.fn(),
  completeAgentRunIfUnbound: vi.fn(),
}));

vi.mock("@chia/db/repos/agent", () => repo);

const db = drizzle.mock({ relations });

const row = (overrides: {
  id: string;
  externalRunId: string;
  startedAt?: Date;
}) => ({
  id: overrides.id,
  sessionId: "session-1",
  status: AgentRunStatus.Active,
  externalRunId: overrides.externalRunId,
  metadata: {
    turn: {
      seqBefore: 0,
      streamIndex: 0,
      deltaStreamIndex: 0,
      running: true,
      claimed: false,
    },
  },
  startedAt: overrides.startedAt ?? new Date(),
  endedAt: null,
});

/** `getRun` for a set of live workflow run ids; every other id does not exist. */
const liveRuns = (ids: string[]) =>
  getRun.mockImplementation((id: string) => ({
    exists: Promise.resolve(ids.includes(id)),
    status: Promise.resolve("running"),
  }));

describe("reconcileRunningAgentTurns", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetWorkflowMocks();
    repo.completeAgentRunIfUnbound.mockResolvedValue(true);
  });

  it("closes a marked run whose World run is gone", async () => {
    const { reconcileRunningAgentTurns } = await import("../run-liveness");
    liveRuns(["wf-live"]);
    repo.listRunningAgentRuns.mockResolvedValue([
      row({ id: "run-live", externalRunId: "wf-live" }),
      row({ id: "run-dead", externalRunId: "wf-dead" }),
    ]);

    await expect(reconcileRunningAgentTurns(db, runs, "user-1")).resolves.toBe(
      1
    );

    expect(repo.listRunningAgentRuns).toHaveBeenCalledWith(db, {
      userId: "user-1",
      turnKey: "turn",
    });
    expect(repo.completeAgentRunIfUnbound).toHaveBeenCalledExactlyOnceWith(
      db,
      "run-dead",
      "wf-dead",
      AgentRunStatus.Failed
    );
  });

  it("keeps a young unbound lease and closes an old one", async () => {
    const { RUN_LEASE_TTL_MS, reconcileRunningAgentTurns } =
      await import("../run-liveness");
    liveRuns([]);
    repo.listRunningAgentRuns.mockResolvedValue([
      row({ id: "lease-young", externalRunId: "lease-young" }),
      row({
        id: "lease-old",
        externalRunId: "lease-old",
        startedAt: new Date(Date.now() - RUN_LEASE_TTL_MS - 1),
      }),
    ]);

    await expect(reconcileRunningAgentTurns(db, runs, "user-1")).resolves.toBe(
      1
    );

    expect(repo.completeAgentRunIfUnbound).toHaveBeenCalledExactlyOnceWith(
      db,
      "lease-old",
      "lease-old",
      AgentRunStatus.Failed
    );
  });

  it("leaves a lease alone that the executor claimed after the snapshot was read", async () => {
    const { RUN_LEASE_TTL_MS, reconcileRunningAgentTurns } =
      await import("../run-liveness");
    liveRuns([]);
    repo.listRunningAgentRuns.mockResolvedValue([
      row({
        id: "lease-old",
        externalRunId: "lease-old",
        startedAt: new Date(Date.now() - RUN_LEASE_TTL_MS - 1),
      }),
    ]);
    // Between the snapshot and the close the step bound its real run id, so the conditional
    // close misses and the run it now drives stays active.
    repo.completeAgentRunIfUnbound.mockResolvedValue(false);

    await expect(reconcileRunningAgentTurns(db, runs, "user-1")).resolves.toBe(
      0
    );
  });
});
