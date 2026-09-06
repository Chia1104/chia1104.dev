import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  createFakeRuns,
  getRun,
  resetWorkflowMocks,
} from "@chia/test/mocks/workflow";

/**
 * Every turn is its own run. Admission writes the run row under the session lock and
 * commits, then starts the workflow; the row is the record of what was accepted, and a
 * start whose result is unknown keeps it as the session's lease.
 */

const runs = createFakeRuns();

const repo = vi.hoisted(() => ({
  bindAgentRunExternalId: vi.fn(),
  completeAgentRun: vi.fn(),
  createAgentRun: vi.fn(),
  decideAgentApproval: vi.fn(),
  getAgentApproval: vi.fn(),
  getAgentSessionLastSeq: vi.fn(async () => 4),
  listRunningAgentRuns: vi.fn(async () => []),
  withAgentSessionLock: vi.fn(),
}));
const quota = vi.hoisted(() => ({
  assertBelowRunningTurnCap: vi.fn(),
  assertWithinAgentQuota: vi.fn(),
}));
const abort = vi.hoisted(() => ({
  AGENT_ABORT_CONTROLLER_KEY: "abortController",
  readAgentAbortControllerRef: () => undefined,
  signalAgentAbort: vi.fn(async () => true),
  startAgentAbortController: vi.fn(async () => ({
    id: "abort-1",
    runId: "abort-run-1",
  })),
}));

vi.mock("@chia/db/repos/agent", () => repo);
vi.mock("@chia/agent-host/quota", () => quota);
vi.mock("../orpc/services/agent/abort", () => abort);

import type { DB } from "@chia/db/client";
import { AppError } from "@chia/service-kit/errors";

import { createAgentTurnOperations } from "../orpc/services/agent/turn";

/** Whatever the lock callback returns; the mock passes it through untouched. */
type Admitted = object | null;

const db =
  /* SAFETY: every repository operation in this suite is mocked. */ {} as never;

/** Whether the lock transaction is open; delivery must observe it closed. */
let lockHeld = false;

const workflow = {
  cancelRun: vi.fn(),
  startAgentSession: vi.fn(),
};

const caller =
  /* SAFETY: admission reads only the user id, the db handle and the workflow client. */ {
    userId: "user-1",
    tier: 4,
    context: { db, workflow, headers: new Headers() },
  } as never;

const loadOwnedSession = vi.fn();
const undecidedApprovals = vi.fn(async (): Promise<string[]> => []);

const sessions =
  /* SAFETY: admission uses only these three session operations. */ {
    withDb: (outer: { context: object }, tx: DB) => ({
      ...outer,
      context: { ...outer.context, db: tx },
    }),
    loadOwnedSession,
    undecidedApprovals,
  } as never;

const definition =
  /* SAFETY: no test attaches anything, so the kind's state hooks are never read. */ {
    kind: "writing",
    state: {},
  } as never;
const host =
  /* SAFETY: admission reads the runs host and the credential reader only. */ {
    runs,
    credentials: { read: () => undefined },
  } as never;

const liveRun = (status: "pending" | "running" | "completed" = "running") => {
  getRun.mockReturnValue({
    exists: Promise.resolve(status !== "completed"),
    status: Promise.resolve(status),
    getReadable: vi.fn(() =>
      Object.assign(new ReadableStream({ start: (c) => c.close() }), {
        getTailIndex: async () => 9,
      })
    ),
  });
};

/** A session row with a live prior run (`running` says whether its turn still executes) or none. */
const session = (overrides: {
  running?: boolean;
  workflowRunId?: string | null;
}) => ({
  id: "session-1",
  activeRunId: overrides.workflowRunId === null ? null : "run-1",
  workflowRunId:
    overrides.workflowRunId === undefined ? "wf-1" : overrides.workflowRunId,
  startedAt: new Date(),
  turn: {
    seqBefore: 0,
    streamIndex: 0,
    deltaStreamIndex: 0,
    running: overrides.running ?? false,
  },
});

const turns = createAgentTurnOperations(definition, sessions, host);

const createdRunId = () => repo.createAgentRun.mock.calls[0]?.[1].id;

beforeEach(() => {
  vi.clearAllMocks();
  resetWorkflowMocks();
  lockHeld = false;
  repo.withAgentSessionLock.mockImplementation(
    async (_db: DB, _id: string, fn: (tx: DB) => Promise<Admitted>) => {
      lockHeld = true;
      try {
        return await fn(db);
      } finally {
        lockHeld = false;
      }
    }
  );
  repo.getAgentSessionLastSeq.mockResolvedValue(4);
  repo.listRunningAgentRuns.mockResolvedValue([]);
  repo.bindAgentRunExternalId.mockResolvedValue(undefined);
  repo.completeAgentRun.mockResolvedValue(undefined);
  undecidedApprovals.mockResolvedValue([]);
  workflow.startAgentSession.mockResolvedValue("wf-2");
  workflow.cancelRun.mockResolvedValue(undefined);
});

describe("agent turn admission", () => {
  it("refuses a prompt while a turn is running", async () => {
    liveRun("running");
    loadOwnedSession.mockResolvedValue(session({ running: true }));

    await expect(
      turns.prompt(caller, { sessionId: "session-1", text: "next" })
    ).rejects.toMatchObject({ code: "CONFLICT" });
    expect(repo.createAgentRun).not.toHaveBeenCalled();
    expect(workflow.startAgentSession).not.toHaveBeenCalled();
  });

  it("refuses a prompt while an approval is undecided", async () => {
    liveRun("completed");
    loadOwnedSession.mockResolvedValue(session({ workflowRunId: null }));
    undecidedApprovals.mockResolvedValue(["commit_draft"]);

    await expect(
      turns.prompt(caller, { sessionId: "session-1", text: "next" })
    ).rejects.toMatchObject({ code: "CONFLICT" });
    expect(repo.createAgentRun).not.toHaveBeenCalled();
  });

  it("writes the run row as the lease, starts the workflow after the commit and binds the run id", async () => {
    liveRun("completed");
    loadOwnedSession.mockResolvedValue(session({ workflowRunId: null }));
    workflow.startAgentSession.mockImplementation(async () => {
      expect(lockHeld).toBe(false);
      expect(repo.createAgentRun).toHaveBeenCalledOnce();
      return "wf-2";
    });

    const cursor = await turns.prompt(caller, {
      sessionId: "session-1",
      text: "first",
    });

    expect(cursor).toEqual({
      runId: "wf-2",
      startIndex: 0,
      deltaStartIndex: 0,
      startedRun: true,
    });
    expect(workflow.startAgentSession).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionId: "session-1",
        runId: createdRunId(),
        message: expect.objectContaining({ text: "first" }),
      })
    );
    expect(repo.bindAgentRunExternalId).toHaveBeenCalledWith(
      db,
      createdRunId(),
      "wf-2"
    );
  });

  it("cancels a prior run that is still alive between turns once its row is replaced", async () => {
    liveRun("running");
    loadOwnedSession.mockResolvedValue(session({ running: false }));

    await turns.prompt(caller, { sessionId: "session-1", text: "next" });

    expect(workflow.cancelRun).toHaveBeenCalledExactlyOnceWith("wf-1");
    expect(workflow.startAgentSession).toHaveBeenCalledOnce();
  });

  it("fails the lease row and closes its controller when the workflow service refused the start", async () => {
    liveRun("completed");
    loadOwnedSession.mockResolvedValue(session({ workflowRunId: null }));
    workflow.startAgentSession.mockRejectedValue(
      new AppError("UNAUTHORIZED", { message: "bad control token" })
    );

    await expect(
      turns.prompt(caller, { sessionId: "session-1", text: "first" })
    ).rejects.toThrow("bad control token");

    expect(repo.completeAgentRun).toHaveBeenCalledWith(
      db,
      createdRunId(),
      "failed"
    );
    expect(abort.signalAgentAbort).toHaveBeenCalledWith(
      workflow,
      "abort-1",
      expect.any(String)
    );
    expect(repo.bindAgentRunExternalId).not.toHaveBeenCalled();
  });

  it("keeps the lease when the start's result is unknown, since the workflow may be running", async () => {
    liveRun("completed");
    loadOwnedSession.mockResolvedValue(session({ workflowRunId: null }));
    workflow.startAgentSession.mockRejectedValue(
      new AppError("INTERNAL_SERVER_ERROR", { message: "socket hang up" })
    );

    await expect(
      turns.prompt(caller, { sessionId: "session-1", text: "first" })
    ).rejects.toThrow("socket hang up");

    expect(repo.completeAgentRun).not.toHaveBeenCalled();
    expect(abort.signalAgentAbort).not.toHaveBeenCalled();
  });

  it("stops a started workflow whose row could not be bound, and fails the row only once the turn ended", async () => {
    liveRun("completed");
    loadOwnedSession.mockResolvedValue(session({ workflowRunId: null }));
    repo.bindAgentRunExternalId.mockRejectedValue(new Error("db gone"));

    await expect(
      turns.prompt(caller, { sessionId: "session-1", text: "first" })
    ).rejects.toThrow("db gone");

    // The row still carries its lease id, so abort could not find the run: stop it on the
    // id this request holds, wait for the turn to end, then cancel and close the row.
    expect(abort.signalAgentAbort).toHaveBeenCalledWith(
      workflow,
      "abort-1",
      expect.any(String)
    );
    expect(workflow.cancelRun).toHaveBeenCalledExactlyOnceWith("wf-2");
    expect(repo.completeAgentRun).toHaveBeenCalledWith(
      db,
      createdRunId(),
      "failed"
    );
  });

  it("leaves the lease blocking the session when the abort cannot be delivered", async () => {
    liveRun("completed");
    loadOwnedSession.mockResolvedValue(session({ workflowRunId: null }));
    repo.bindAgentRunExternalId.mockRejectedValue(new Error("db gone"));
    abort.signalAgentAbort.mockResolvedValueOnce(false);

    await expect(
      turns.prompt(caller, { sessionId: "session-1", text: "first" })
    ).rejects.toThrow("db gone");

    // The executor may still be running: nothing may report the session idle.
    expect(workflow.cancelRun).not.toHaveBeenCalled();
    expect(repo.completeAgentRun).not.toHaveBeenCalled();
  });

  it("records a pending decision once and starts the run that relays it", async () => {
    liveRun("completed");
    loadOwnedSession.mockResolvedValue(session({ workflowRunId: null }));
    repo.getAgentApproval.mockResolvedValue({
      status: "pending",
      toolCallId: "call-1",
      toolName: "commit_draft",
      comment: null,
    });
    repo.decideAgentApproval.mockResolvedValue({ status: "approved" });
    workflow.startAgentSession.mockImplementation(async () => {
      expect(lockHeld).toBe(false);
      return "wf-2";
    });

    const cursor = await turns.approve(caller, {
      sessionId: "session-1",
      toolCallId: "call-1",
      approved: true,
      comment: "go",
    });

    expect(cursor).toEqual({
      runId: "wf-2",
      startIndex: 0,
      deltaStartIndex: 0,
    });
    expect(repo.decideAgentApproval).toHaveBeenCalledExactlyOnceWith(
      db,
      expect.objectContaining({ toolCallId: "call-1", approved: true })
    );
    expect(workflow.startAgentSession).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.objectContaining({
          text: expect.stringContaining("commit_draft"),
          decision: {
            toolCallId: "call-1",
            toolName: "commit_draft",
            approved: true,
            comment: "go",
          },
        }),
      })
    );
  });

  it("starts nothing for a request already decided", async () => {
    liveRun("completed");
    loadOwnedSession.mockResolvedValue(session({ workflowRunId: null }));
    repo.getAgentApproval.mockResolvedValue({
      status: "approved",
      toolCallId: "call-1",
      toolName: "commit_draft",
      comment: "go",
    });

    await expect(
      turns.approve(caller, {
        sessionId: "session-1",
        toolCallId: "call-1",
        approved: false,
      })
    ).resolves.toBeNull();

    expect(repo.decideAgentApproval).not.toHaveBeenCalled();
    expect(repo.createAgentRun).not.toHaveBeenCalled();
    expect(workflow.startAgentSession).not.toHaveBeenCalled();
  });
});
