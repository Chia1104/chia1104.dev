import { beforeEach, describe, expect, it, vi } from "vitest";

import { createFakeRuns, getRun, resetWorkflowMocks } from "@chia/test/mocks/workflow";

const runs = createFakeRuns();

/**
 * A turn marker is only "running" while the World run that would execute it is alive.
 * A marker on a dead run is closed as failed; a marker on a live run and a young unbound
 * lease are left alone; an old unbound lease is dead.
 */

const repo = vi.hoisted(() => ({
  listRunningAgentRuns: vi.fn(),
  completeAgentRun: vi.fn(),
}));
const abort = vi.hoisted(() => ({ signalAgentAbort: vi.fn() }));

vi.mock("@chia/db/repos/agent", () => repo);
vi.mock("../orpc/services/agent/abort", () => ({
  readAgentAbortControllerRef: (metadata: { abortController?: unknown }) =>
    metadata.abortController,
  signalAgentAbort: abort.signalAgentAbort,
}));

const db =
  /* SAFETY: the repo is mocked; nothing reads the handle. */ {} as never;
const workflow =
  /* SAFETY: the abort function is mocked; nothing reads the client. */ {} as never;

const row = (overrides: {
  id: string;
  externalRunId: string;
  startedAt?: Date;
  abortController?: { id: string; runId: string };
}) => ({
  id: overrides.id,
  sessionId: "session-1",
  harnessKind: "workflow",
  harnessVersion: 1,
  status: "active" as const,
  externalRunId: overrides.externalRunId,
  metadata: {
    turn: { seqBefore: 0, streamIndex: 0, deltaStreamIndex: 0, running: true },
    ...(overrides.abortController && {
      abortController: overrides.abortController,
    }),
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
    repo.completeAgentRun.mockResolvedValue(undefined);
    abort.signalAgentAbort.mockResolvedValue(true);
  });

  it("closes a marked run whose World run is gone and releases its controller", async () => {
    const { reconcileRunningAgentTurns } =
      await import("../orpc/services/agent/run-liveness");
    liveRuns(["wf-live"]);
    repo.listRunningAgentRuns.mockResolvedValue([
      row({ id: "run-live", externalRunId: "wf-live" }),
      row({
        id: "run-dead",
        externalRunId: "wf-dead",
        abortController: { id: "abort-dead", runId: "abort-run" },
      }),
    ]);

    await expect(
      reconcileRunningAgentTurns(db, runs, workflow, "user-1")
    ).resolves.toBe(1);

    expect(repo.listRunningAgentRuns).toHaveBeenCalledWith(db, {
      userId: "user-1",
      turnKey: "turn",
    });
    expect(repo.completeAgentRun).toHaveBeenCalledExactlyOnceWith(
      db,
      "run-dead",
      "failed"
    );
    expect(abort.signalAgentAbort).toHaveBeenCalledExactlyOnceWith(
      workflow,
      "abort-dead",
      "run lost"
    );
  });

  it("keeps a young unbound lease and closes an old one", async () => {
    const { RUN_LEASE_TTL_MS, reconcileRunningAgentTurns } =
      await import("../orpc/services/agent/run-liveness");
    liveRuns([]);
    repo.listRunningAgentRuns.mockResolvedValue([
      row({ id: "lease-young", externalRunId: "lease-young" }),
      row({
        id: "lease-old",
        externalRunId: "lease-old",
        startedAt: new Date(Date.now() - RUN_LEASE_TTL_MS - 1),
      }),
    ]);

    await expect(
      reconcileRunningAgentTurns(db, runs, workflow, "user-1")
    ).resolves.toBe(1);

    expect(repo.completeAgentRun).toHaveBeenCalledExactlyOnceWith(
      db,
      "lease-old",
      "failed"
    );
  });
});
