import { drizzle } from "drizzle-orm/node-postgres";
import Keyv from "keyv";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { CallerTier } from "@chia/auth/tier";
import {
  createFakeRuns,
  getRun,
  resetWorkflowMocks,
} from "@chia/test/mocks/workflow";
import { createWorkflowControlClient } from "@chia/workflow-control/client";

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
  getAgentApprovalBatch: vi.fn(),
  getAgentRun: vi.fn(),
  getAgentSessionLastSeq: vi.fn(async () => 4),
  listRunningAgentRuns: vi.fn(async () => []),
  setAgentApprovalRelayRun: vi.fn(async () => undefined),
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
vi.mock("../abort", () => abort);

import type { DB } from "@chia/db/client";
import {
  AgentApprovalStatus,
  AgentRunStatus,
  relations,
} from "@chia/db/schema";
import type { AgentToolApproval } from "@chia/db/schema";
import { AppError, AppErrorCode } from "@chia/service-kit/errors";

import type { AgentServiceHost } from "../agent.factory";
import type { AgentServiceCaller } from "../agent.service";
import { createAgentTurnOperations } from "../turn";

/** Whatever the lock callback returns; the mock passes it through untouched. */
type Admitted = object | null;

const db = drizzle.mock({ relations });

/** Whether the lock transaction is open; delivery must observe it closed. */
let lockHeld = false;

const workflow = createWorkflowControlClient({
  url: "http://workflow.test",
  token: "test",
  fetch: () => Promise.reject(new Error("unmocked workflow command")),
});
const cancelRun = vi.spyOn(workflow, "cancelRun");
const startAgentSession = vi.spyOn(workflow, "startAgentSession");

const caller: AgentServiceCaller = {
  tier: CallerTier.Root,
  adminId: "user-1",
  userId: "user-1",
  context: {
    headers: new Headers(),
    clientIP: "127.0.0.1",
    db,
    kv: new Keyv(),
    workflow,
  },
};

const loadOwnedSession = vi.fn();
const undecidedApprovals = vi.fn(async (): Promise<string[]> => []);

const sessions = {
  withDb: (outer: AgentServiceCaller, tx: DB): AgentServiceCaller => ({
    ...outer,
    context: { ...outer.context, db: tx },
  }),
  loadOwnedSession,
  undecidedApprovals,
};

/** No test attaches anything, so the kind needs no state hooks. */
const definition = { kind: "writing", state: {} };
const host: AgentServiceHost = {
  runs,
  credentials: { read: () => undefined, decrypt: () => ({}) },
};

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
    claimed: overrides.running ?? false,
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
  repo.setAgentApprovalRelayRun.mockResolvedValue(undefined);
  undecidedApprovals.mockResolvedValue([]);
  startAgentSession.mockResolvedValue("wf-2");
  cancelRun.mockResolvedValue(undefined);
});

describe("agent turn admission", () => {
  it("refuses a prompt while a turn is running", async () => {
    liveRun("running");
    loadOwnedSession.mockResolvedValue(session({ running: true }));

    await expect(
      turns.prompt(caller, { sessionId: "session-1", text: "next" })
    ).rejects.toMatchObject({ code: AppErrorCode.Conflict });
    expect(repo.createAgentRun).not.toHaveBeenCalled();
    expect(startAgentSession).not.toHaveBeenCalled();
    // The controller was started ahead of the lock; a refusal closes it rather than leaving
    // it parked until its TTL.
    expect(abort.signalAgentAbort).toHaveBeenCalledWith(
      workflow,
      "abort-1",
      expect.any(String)
    );
  });

  it("starts the abort controller before taking the session lock", async () => {
    liveRun("completed");
    loadOwnedSession.mockResolvedValue(session({ workflowRunId: null }));
    abort.startAgentAbortController.mockImplementationOnce(async () => {
      expect(lockHeld).toBe(false);
      return { id: "abort-1", runId: "abort-run-1" };
    });

    await turns.prompt(caller, { sessionId: "session-1", text: "first" });

    expect(abort.startAgentAbortController).toHaveBeenCalledOnce();
  });

  it("refuses a prompt while an approval is undecided", async () => {
    liveRun("completed");
    loadOwnedSession.mockResolvedValue(session({ workflowRunId: null }));
    undecidedApprovals.mockResolvedValue(["commit_draft"]);

    await expect(
      turns.prompt(caller, { sessionId: "session-1", text: "next" })
    ).rejects.toMatchObject({ code: AppErrorCode.Conflict });
    expect(repo.createAgentRun).not.toHaveBeenCalled();
  });

  it("writes the run row as the lease, starts the workflow after the commit and binds the run id", async () => {
    liveRun("completed");
    loadOwnedSession.mockResolvedValue(session({ workflowRunId: null }));
    startAgentSession.mockImplementation(async () => {
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
    expect(startAgentSession).toHaveBeenCalledWith(
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

    expect(cancelRun).toHaveBeenCalledExactlyOnceWith("wf-1");
    expect(startAgentSession).toHaveBeenCalledOnce();
  });

  it("fails the lease row and closes its controller when the workflow service refused the start", async () => {
    liveRun("completed");
    loadOwnedSession.mockResolvedValue(session({ workflowRunId: null }));
    startAgentSession.mockRejectedValue(
      new AppError(AppErrorCode.Unauthorized, { message: "bad control token" })
    );

    await expect(
      turns.prompt(caller, { sessionId: "session-1", text: "first" })
    ).rejects.toThrow("bad control token");

    expect(repo.completeAgentRun).toHaveBeenCalledWith(
      db,
      createdRunId(),
      AgentRunStatus.Failed
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
    startAgentSession.mockRejectedValue(
      new AppError(AppErrorCode.InternalServerError, {
        message: "socket hang up",
      })
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
    expect(cancelRun).toHaveBeenCalledExactlyOnceWith("wf-2");
    expect(repo.completeAgentRun).toHaveBeenCalledWith(
      db,
      createdRunId(),
      AgentRunStatus.Failed
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
    expect(cancelRun).not.toHaveBeenCalled();
    expect(repo.completeAgentRun).not.toHaveBeenCalled();
  });

  /** A recorded request of run `run-0`, as the approval row stores it. */
  const approvalRow = (fields: Partial<AgentToolApproval> = {}) => ({
    status: AgentApprovalStatus.Pending,
    toolCallId: "call-1",
    toolName: "commit_draft",
    approvalKey: "commit_draft:7@hash",
    comment: null,
    decidedBy: null,
    runId: "run-0",
    relayRunId: null,
    ...fields,
  });

  it("records a pending decision and starts the run that resumes its batch", async () => {
    liveRun("completed");
    loadOwnedSession.mockResolvedValue(session({ workflowRunId: null }));
    repo.getAgentApproval.mockResolvedValue(approvalRow());
    repo.decideAgentApproval.mockResolvedValue(
      approvalRow({ status: AgentApprovalStatus.Approved })
    );
    repo.getAgentApprovalBatch.mockResolvedValue([
      approvalRow({
        status: AgentApprovalStatus.Approved,
        comment: "go",
        decidedBy: "user-1",
      }),
    ]);
    startAgentSession.mockImplementation(async () => {
      expect(lockHeld).toBe(false);
      return "wf-2";
    });

    const result = await turns.approve(caller, {
      sessionId: "session-1",
      toolCallId: "call-1",
      approved: true,
      comment: "go",
    });

    expect(result).toEqual({
      cursor: { runId: "wf-2", startIndex: 0, deltaStartIndex: 0 },
    });
    expect(repo.decideAgentApproval).toHaveBeenCalledExactlyOnceWith(
      db,
      expect.objectContaining({ toolCallId: "call-1", approved: true })
    );
    expect(startAgentSession).toHaveBeenCalledWith(
      expect.objectContaining({
        message: {
          resume: {
            interruptedRunId: "run-0",
            decisions: [
              { toolCallId: "call-1", approved: true, comment: "go" },
            ],
          },
          credentials: undefined,
        },
      })
    );
  });

  it("records a decision and starts nothing while the rest of its batch waits", async () => {
    liveRun("completed");
    loadOwnedSession.mockResolvedValue(session({ workflowRunId: null }));
    repo.getAgentApproval.mockResolvedValue(approvalRow());
    repo.decideAgentApproval.mockResolvedValue(
      approvalRow({ status: AgentApprovalStatus.Approved })
    );
    repo.getAgentApprovalBatch.mockResolvedValue([
      approvalRow({
        status: AgentApprovalStatus.Approved,
        decidedBy: "user-1",
      }),
      approvalRow({ toolCallId: "call-2" }),
    ]);

    await expect(
      turns.approve(caller, {
        sessionId: "session-1",
        toolCallId: "call-1",
        approved: true,
      })
    ).resolves.toEqual({ cursor: null });

    expect(repo.decideAgentApproval).toHaveBeenCalledOnce();
    expect(repo.createAgentRun).not.toHaveBeenCalled();
    expect(startAgentSession).not.toHaveBeenCalled();
  });

  it("names the resuming run on its batch in the same transaction", async () => {
    liveRun("completed");
    loadOwnedSession.mockResolvedValue(session({ workflowRunId: null }));
    repo.getAgentApproval.mockResolvedValue(approvalRow());
    repo.decideAgentApproval.mockResolvedValue(
      approvalRow({ status: AgentApprovalStatus.Approved })
    );
    repo.getAgentApprovalBatch.mockResolvedValue([
      approvalRow({
        status: AgentApprovalStatus.Approved,
        decidedBy: "user-1",
      }),
    ]);
    repo.setAgentApprovalRelayRun.mockImplementation(async () => {
      expect(lockHeld).toBe(true);
    });

    await turns.approve(caller, {
      sessionId: "session-1",
      toolCallId: "call-1",
      approved: true,
    });

    expect(repo.setAgentApprovalRelayRun).toHaveBeenCalledExactlyOnceWith(db, {
      sessionId: "session-1",
      runId: "run-0",
      relayRunId: createdRunId(),
    });
  });

  it("delivers a decided batch again when its resuming run was refused, without rewriting it", async () => {
    liveRun("completed");
    loadOwnedSession.mockResolvedValue(session({ workflowRunId: null }));
    const decided = approvalRow({
      status: AgentApprovalStatus.Rejected,
      comment: "not yet",
      decidedBy: "user-1",
      relayRunId: "run-refused",
    });
    repo.getAgentApproval.mockResolvedValue(decided);
    repo.getAgentApprovalBatch.mockResolvedValue([
      decided,
      // Refused by the turn's own checks: decided, and by nobody.
      approvalRow({
        toolCallId: "call-2",
        status: AgentApprovalStatus.Rejected,
        comment: "The draft is empty.",
        relayRunId: "run-refused",
      }),
      // Approved because the session pre-approved its tier: also decided by nobody.
      approvalRow({
        toolCallId: "call-3",
        status: AgentApprovalStatus.Approved,
        relayRunId: "run-refused",
      }),
    ]);
    // Refused before any executor claimed it: the lease marker never became a claim.
    repo.getAgentRun.mockResolvedValue({
      id: "run-refused",
      status: AgentRunStatus.Failed,
      metadata: {
        turn: {
          seqBefore: 0,
          streamIndex: 0,
          deltaStreamIndex: 0,
          running: true,
          claimed: false,
        },
      },
    });

    // The retry says "approve"; the row says "rejected" and the row wins.
    const result = await turns.approve(caller, {
      sessionId: "session-1",
      toolCallId: "call-1",
      approved: true,
    });

    expect(result).toEqual({
      cursor: { runId: "wf-2", startIndex: 0, deltaStartIndex: 0 },
    });
    expect(repo.decideAgentApproval).not.toHaveBeenCalled();
    expect(startAgentSession).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.objectContaining({
          resume: {
            interruptedRunId: "run-0",
            decisions: [
              { toolCallId: "call-1", approved: false, comment: "not yet" },
              {
                toolCallId: "call-2",
                approved: false,
                comment: "The draft is empty.",
                refused: true,
              },
              { toolCallId: "call-3", approved: true },
            ],
          },
        }),
      })
    );
    // The new resuming run replaces the refused one on the batch.
    expect(repo.setAgentApprovalRelayRun).toHaveBeenCalledWith(db, {
      sessionId: "session-1",
      runId: "run-0",
      relayRunId: createdRunId(),
    });
  });

  it("starts nothing for a batch whose resuming run executed or is still unresolved", async () => {
    liveRun("completed");
    loadOwnedSession.mockResolvedValue(session({ workflowRunId: null }));
    repo.getAgentApproval.mockResolvedValue(
      approvalRow({
        status: AgentApprovalStatus.Approved,
        comment: "go",
        decidedBy: "user-1",
        relayRunId: "run-relay",
      })
    );
    const claimed = {
      turn: {
        seqBefore: 0,
        streamIndex: 0,
        deltaStreamIndex: 0,
        running: false,
        claimed: true,
      },
    };

    // Completed, still a lease, failed after the executor ran it, aborted while it ran: none
    // may be delivered again, because the engine has run or may yet run the batch.
    for (const run of [
      { status: AgentRunStatus.Completed, metadata: claimed },
      { status: AgentRunStatus.Active, metadata: {} },
      { status: AgentRunStatus.Failed, metadata: claimed },
      { status: AgentRunStatus.Cancelled, metadata: claimed },
    ]) {
      repo.getAgentRun.mockResolvedValue({ id: "run-relay", ...run });
      await expect(
        turns.approve(caller, {
          sessionId: "session-1",
          toolCallId: "call-1",
          approved: false,
        })
      ).resolves.toBeNull();
    }

    expect(repo.decideAgentApproval).not.toHaveBeenCalled();
    expect(repo.createAgentRun).not.toHaveBeenCalled();
    expect(startAgentSession).not.toHaveBeenCalled();
  });

  it("starts nothing for a request recorded before turns became resumable", async () => {
    liveRun("completed");
    loadOwnedSession.mockResolvedValue(session({ workflowRunId: null }));
    repo.getAgentApproval.mockResolvedValue(approvalRow({ runId: null }));

    await expect(
      turns.approve(caller, {
        sessionId: "session-1",
        toolCallId: "call-1",
        approved: true,
      })
    ).resolves.toBeNull();

    expect(repo.decideAgentApproval).not.toHaveBeenCalled();
    expect(startAgentSession).not.toHaveBeenCalled();
  });
});
