import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  createFakeRuns,
  getHookByToken,
  getRun,
  resetWorkflowMocks,
} from "@chia/test/mocks/workflow";

/**
 * Turn admission commits before it delivers: the database records what was accepted, then
 * the workflow is told. A delivery that fails is compensated on the row; a decision that was
 * recorded but never delivered is redelivered rather than rewritten.
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
  patchAgentRunMetadata: vi.fn(),
  releaseAgentRunTurn: vi.fn(async () => undefined),
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
  resumeAgentMessage: vi.fn(),
  resumeAgentApproval: vi.fn(),
  startAgentSession: vi.fn(),
};

const caller =
  /* SAFETY: admission reads only the user id, the db handle and the workflow client. */ {
    userId: "user-1",
    tier: 4,
    context: { db, workflow, headers: new Headers() },
  } as never;

const loadOwnedSession = vi.fn();

const sessions =
  /* SAFETY: admission uses only these three session operations. */ {
    withDb: (outer: { context: object }, tx: DB) => ({
      ...outer,
      context: { ...outer.context, db: tx },
    }),
    loadOwnedSession,
    undecidedApprovals: vi.fn(async () => []),
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
    claimId: null,
  },
});

const turns = createAgentTurnOperations(definition, sessions, host);

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
  repo.releaseAgentRunTurn.mockResolvedValue(undefined);
  getHookByToken.mockResolvedValue({ token: "any" });
  workflow.resumeAgentMessage.mockResolvedValue(undefined);
  workflow.resumeAgentApproval.mockResolvedValue(undefined);
  workflow.startAgentSession.mockResolvedValue("wf-2");
  repo.bindAgentRunExternalId.mockResolvedValue(undefined);
  repo.completeAgentRun.mockResolvedValue(undefined);
});

describe("agent turn admission", () => {
  it("refuses a prompt while a turn is running instead of queueing it", async () => {
    liveRun("running");
    loadOwnedSession.mockResolvedValue(session({ running: true }));

    await expect(
      turns.prompt(caller, { sessionId: "session-1", text: "next" })
    ).rejects.toMatchObject({ code: "CONFLICT" });
    expect(workflow.resumeAgentMessage).not.toHaveBeenCalled();
    expect(repo.patchAgentRunMetadata).not.toHaveBeenCalled();
  });

  it("claims the turn under the lock, commits, then resumes the hook; a refused resume releases that claim by id", async () => {
    liveRun("running");
    loadOwnedSession.mockResolvedValue(session({ running: false }));
    workflow.resumeAgentMessage.mockImplementation(async () => {
      expect(lockHeld).toBe(false);
      throw new AppError("UNAUTHORIZED", { message: "bad control token" });
    });

    await expect(
      turns.prompt(caller, { sessionId: "session-1", text: "next" })
    ).rejects.toThrow("bad control token");

    const claimId = repo.patchAgentRunMetadata.mock.calls[0]?.[2].turn.claimId;
    expect(claimId).toEqual(expect.any(String));
    expect(repo.releaseAgentRunTurn).toHaveBeenCalledExactlyOnceWith(
      db,
      "run-1",
      "turn",
      claimId
    );
  });

  it("keeps the claim when the delivery result is unknown", async () => {
    liveRun("running");
    loadOwnedSession.mockResolvedValue(session({ running: false }));
    // A dropped response: the hook may well have resumed and the step may be running.
    workflow.resumeAgentMessage.mockRejectedValue(
      new AppError("INTERNAL_SERVER_ERROR", { message: "socket hang up" })
    );

    await expect(
      turns.prompt(caller, { sessionId: "session-1", text: "next" })
    ).rejects.toThrow("socket hang up");

    expect(repo.patchAgentRunMetadata).toHaveBeenCalledOnce();
    expect(repo.releaseAgentRunTurn).not.toHaveBeenCalled();
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
    const runId = repo.createAgentRun.mock.calls[0]?.[1].id;
    expect(repo.bindAgentRunExternalId).toHaveBeenCalledWith(db, runId, "wf-2");
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

    const runId = repo.createAgentRun.mock.calls[0]?.[1].id;
    expect(repo.completeAgentRun).toHaveBeenCalledWith(db, runId, "failed");
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
    workflow.cancelRun.mockResolvedValue(undefined);

    await expect(
      turns.prompt(caller, { sessionId: "session-1", text: "first" })
    ).rejects.toThrow("db gone");

    const runId = repo.createAgentRun.mock.calls[0]?.[1].id;
    // The row still carries its lease id, so abort could not find the run: stop it on the
    // id this request holds, wait for the turn to end, then cancel and close the row.
    expect(abort.signalAgentAbort).toHaveBeenCalledWith(
      workflow,
      "abort-1",
      expect.any(String)
    );
    expect(workflow.cancelRun).toHaveBeenCalledExactlyOnceWith("wf-2");
    expect(repo.completeAgentRun).toHaveBeenCalledWith(db, runId, "failed");
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

  it("records a pending decision once and delivers it after the commit", async () => {
    liveRun("running");
    loadOwnedSession.mockResolvedValue(session({ running: false }));
    repo.getAgentApproval.mockResolvedValue({
      status: "pending",
      comment: null,
    });
    repo.decideAgentApproval.mockResolvedValue({ status: "approved" });
    workflow.resumeAgentApproval.mockImplementation(async () => {
      expect(lockHeld).toBe(false);
    });

    await turns.approve(caller, {
      sessionId: "session-1",
      toolCallId: "call-1",
      approved: true,
      comment: "go",
    });

    expect(repo.decideAgentApproval).toHaveBeenCalledExactlyOnceWith(
      db,
      expect.objectContaining({ toolCallId: "call-1", approved: true })
    );
    expect(workflow.resumeAgentApproval).toHaveBeenCalledWith(
      "session-1",
      "call-1",
      { approved: true, comment: "go", credentials: undefined }
    );
  });

  it("redelivers a recorded decision as recorded while the run still waits on it", async () => {
    liveRun("running");
    loadOwnedSession.mockResolvedValue(session({ running: false }));
    repo.getAgentApproval.mockResolvedValue({
      status: "approved",
      comment: "go",
    });

    // The retry says "reject"; the row says "approved" and the row wins.
    await turns.approve(caller, {
      sessionId: "session-1",
      toolCallId: "call-1",
      approved: false,
    });

    expect(repo.decideAgentApproval).not.toHaveBeenCalled();
    expect(workflow.resumeAgentApproval).toHaveBeenCalledWith(
      "session-1",
      "call-1",
      { approved: true, comment: "go", credentials: undefined }
    );
  });

  it("does nothing for a decided request whose hook is gone", async () => {
    liveRun("running");
    loadOwnedSession.mockResolvedValue(session({ running: false }));
    repo.getAgentApproval.mockResolvedValue({
      status: "rejected",
      comment: null,
    });
    getHookByToken.mockResolvedValue(null);

    await expect(
      turns.approve(caller, {
        sessionId: "session-1",
        toolCallId: "call-1",
        approved: true,
      })
    ).resolves.toBeNull();
    expect(workflow.resumeAgentApproval).not.toHaveBeenCalled();
  });
});
