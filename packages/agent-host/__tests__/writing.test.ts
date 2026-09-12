import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AgentTurnExecution } from "@chia/agent-runtime/types";
import { CallerTier } from "@chia/auth/tier";
import type { DB } from "@chia/db/client";
import type { WritingSessionConsolidation } from "@chia/db/repos/agent";
import type { FeedDraftRecord } from "@chia/db/repos/drafts";

import type { AgentKindCaller, AgentTurnContext } from "../src/kind";

const repo = vi.hoisted(() => ({
  copyWritingSessionDrafts: vi.fn(),
  createWritingAgentSession: vi.fn(),
  getWritingAgentSession: vi.fn(),
  getWritingSessionConsolidation: vi.fn(
    async (): Promise<WritingSessionConsolidation | null> => null
  ),
  touchWritingSessionDrafts: vi.fn(),
  updateWritingSessionConsolidation: vi.fn(),
}));

const drafts = vi.hoisted(() => ({
  getFeedDraft: vi.fn(),
  getFeedDrafts: vi.fn(),
  listOperatorFeedDraftChanges: vi.fn(async () => []),
  patchFeedDraft: vi.fn(),
}));

const runtime = vi.hoisted(() => ({
  runWritingTurn: vi.fn(),
}));

vi.mock("@chia/db/repos/agent", () => repo);
vi.mock("@chia/db/repos/drafts", () => drafts);
vi.mock("@chia/agent-writing/runtime", () => runtime);
vi.mock("../src/tasks", () => ({
  AGENT_TASK_IDS: { sessionCompaction: "session.compaction" },
  resolveAgentTask: vi.fn(async () => ({ model: undefined })),
}));

const { createWritingAgentKind } = await import("../src/writing");

/* SAFETY: every repository call in this suite is mocked; nothing reaches the handle. */
const db = {} as DB;

const caller: AgentKindCaller =
  /* SAFETY: the kind reads only `userId` and `adminId` from the caller. */ {
    tier: CallerTier.Root,
    userId: "author",
    adminId: "author",
  } as AgentKindCaller;

const record = (id: number, userId = "author"): FeedDraftRecord => ({
  id,
  feedId: null,
  userId,
  slug: null,
  type: "post",
  defaultLocale: "zh-TW",
  mainImage: null,
  revision: 3,
  appliedRevision: null,
  createdAt: new Date("2026-09-05T00:00:00Z"),
  updatedAt: new Date("2026-09-05T00:00:00Z"),
  translations: {},
});

const openDraft = vi.fn(async ({ feedId }: { feedId?: number }) => ({
  ...record(99),
  feedId: feedId ?? null,
}));
const listDrafts = vi.fn(async () => [record(7)]);

describe("createWritingAgentKind state", () => {
  const kind = createWritingAgentKind({ openDraft, listDrafts });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates a bare extension row and copies draft references on fork", async () => {
    await kind.state.create(caller, db, "session-1", {});
    expect(repo.createWritingAgentSession).toHaveBeenCalledWith(db, {
      sessionId: "session-1",
    });

    repo.getWritingAgentSession.mockResolvedValue({
      sessionId: "session-1",
      drafts: [],
    });
    await kind.state.fork(db, "session-1", "session-2");
    expect(repo.createWritingAgentSession).toHaveBeenLastCalledWith(db, {
      sessionId: "session-2",
    });
    expect(repo.copyWritingSessionDrafts).toHaveBeenCalledWith(
      db,
      "session-1",
      "session-2"
    );
  });

  it("details the drafts the session worked on and drops one that is gone", async () => {
    drafts.getFeedDrafts.mockResolvedValue([record(7)]);

    const detail = await kind.state.detail(db, "session-1", {
      sessionId: "session-1",
      drafts: [
        { draftId: 7, lastSeenRevision: 2, touchedAt: new Date() },
        { draftId: 8, lastSeenRevision: 0, touchedAt: new Date() },
      ],
    });

    expect(detail.drafts?.map((draft) => draft.id)).toEqual([7]);
    expect(drafts.getFeedDrafts).toHaveBeenCalledWith(db, [7, 8]);
    expect(detail.drafts?.[0]).toMatchObject({
      revision: 3,
      createdAt: "2026-09-05T00:00:00.000Z",
    });
  });

  it("admits a draft attachment the caller owns and records it against the session", async () => {
    drafts.getFeedDraft.mockResolvedValue(record(7));

    await kind.state.attach?.(caller, db, "session-1", [
      { type: "draft", id: 7 },
    ]);

    expect(repo.touchWritingSessionDrafts).toHaveBeenCalledWith(
      db,
      "session-1",
      [{ draftId: 7 }]
    );
  });

  it("admits a selection from a draft the caller owns and records that draft once", async () => {
    drafts.getFeedDraft.mockResolvedValue(record(7));

    await kind.state.attach?.(caller, db, "session-1", [
      { type: "draft", id: 7 },
      {
        type: "selection",
        text: "Selected words",
        source: {
          type: "draft",
          id: 7,
          locale: "zh-TW",
          startLine: 2,
          endLine: 3,
        },
      },
    ]);

    expect(repo.touchWritingSessionDrafts).toHaveBeenCalledWith(
      db,
      "session-1",
      [{ draftId: 7 }]
    );
  });

  it("refuses a selection from a post or from a draft that is not the caller's", async () => {
    await expect(
      kind.state.attach?.(caller, db, "session-1", [
        {
          type: "selection",
          text: "Selected words",
          source: { type: "feed", id: 1, locale: "en" },
        },
      ])
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(
      kind.state.attach?.(caller, db, "session-1", [
        { type: "feed", id: 1, locale: "en" },
      ])
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });

    // The repository scopes the read to the caller; a foreign draft comes back as null.
    drafts.getFeedDraft.mockImplementation(
      async (_db: DB, id: number, userId: string) =>
        id === 7 && userId === "author" ? record(7) : null
    );
    await expect(
      kind.state.attach?.(
        { ...caller, userId: "someone-else" },
        db,
        "session-1",
        [{ type: "draft", id: 7 }]
      )
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(repo.touchWritingSessionDrafts).not.toHaveBeenCalled();
  });
});

describe("createWritingAgentKind runTurn", () => {
  const done: AgentTurnExecution<never> = {
    status: "done",
    error: undefined,
  };
  const startMemoryConsolidation = vi.fn(async () => "wf-1");
  const cancelWorkflowRun = vi.fn(async () => undefined);
  const kind = createWritingAgentKind({
    openDraft,
    listDrafts,
    execution: {
      adminId: () => "author",
      createContentPort: ({ onCommitted }) =>
        /* SAFETY: the mocked turn calls only `applyDraft` on the content port. */ ({
          applyDraft: async () => {
            onCommitted();
            return { feedId: 5, slug: "post", created: false };
          },
        }) as never,
      createMemoryPort: () =>
        /* SAFETY: the mocked turn never calls the memory port. */ ({}) as never,
      createWebPort: () =>
        /* SAFETY: the mocked turn never calls the web port. */ ({}) as never,
      startMemoryConsolidation,
      cancelWorkflowRun,
    },
  });
  const context: AgentTurnContext<
    { sessionId: string; drafts: never[] },
    { instructions?: string },
    never
  > =
    /* SAFETY: the mocked turn reads only the row, state, config and db from the context. */ {
      db,
      row: { id: "session-1" },
      state: { sessionId: "session-1", drafts: [] },
      config: {},
      settings: {},
      models: {},
      access: {},
    } as never;

  beforeEach(() => {
    vi.clearAllMocks();
    repo.getWritingSessionConsolidation.mockResolvedValue(null);
  });

  it("records every draft the turn observed, at the revision it saw", async () => {
    drafts.getFeedDraft.mockImplementation(async (_db: DB, id: number) =>
      id === 7 ? record(7) : null
    );
    runtime.runWritingTurn.mockImplementation(async (options) => {
      // The volatile context and a tool read the draft; the host must remember revision 3.
      await options.draft.get(7);
      await options.draft.open({ feedId: 5 });
      return done;
    });

    const result = await kind.runTurn?.(context);

    expect(result).toBe(done);
    expect(openDraft).toHaveBeenCalledWith({
      db,
      adminId: "author",
      sessionId: "session-1",
      feedId: 5,
    });
    expect(repo.touchWritingSessionDrafts).toHaveBeenCalledWith(
      db,
      "session-1",
      [
        { draftId: 7, lastSeenRevision: 3 },
        { draftId: 99, lastSeenRevision: 3 },
      ]
    );
  });

  it("schedules a delayed lesson extraction after a turn, replacing the one waiting", async () => {
    runtime.runWritingTurn.mockResolvedValue(done);
    repo.getWritingSessionConsolidation.mockResolvedValue({
      consolidatedLeafId: null,
      consolidatedAt: null,
      consolidationRunId: "wf-0",
    });

    await kind.runTurn?.(context);

    expect(cancelWorkflowRun).toHaveBeenCalledWith("wf-0");
    expect(startMemoryConsolidation).toHaveBeenCalledWith({
      sessionId: "session-1",
      delayMs: 2 * 60 * 60 * 1000,
    });
    expect(repo.updateWritingSessionConsolidation).toHaveBeenCalledWith(
      db,
      "session-1",
      { consolidationRunId: "wf-1" }
    );
  });

  it("extracts at once when the turn committed, and never after a turn that did not finish", async () => {
    runtime.runWritingTurn.mockImplementation(async (options) => {
      await options.content.applyDraft({ draftId: 7, expectedRevision: 3 });
      return done;
    });
    await kind.runTurn?.(context);
    expect(startMemoryConsolidation).toHaveBeenCalledWith({
      sessionId: "session-1",
      delayMs: 0,
    });
    expect(cancelWorkflowRun).not.toHaveBeenCalled();

    startMemoryConsolidation.mockClear();
    runtime.runWritingTurn.mockResolvedValue({
      status: "aborted",
      error: undefined,
    });
    await kind.runTurn?.(context);
    expect(startMemoryConsolidation).not.toHaveBeenCalled();
  });
});
