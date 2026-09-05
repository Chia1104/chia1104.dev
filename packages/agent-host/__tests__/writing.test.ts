import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AgentTurnExecution } from "@chia/agent-runtime/types";
import type { DB } from "@chia/db/client";
import type { FeedDraftRecord } from "@chia/db/repos/drafts";
import { CallerTier } from "@chia/service-kit/policies/caller.policy";

import type { AgentKindCaller, AgentTurnContext } from "../src/kind";

const repo = vi.hoisted(() => ({
  copyWritingSessionDrafts: vi.fn(),
  createWritingAgentSession: vi.fn(),
  getWritingAgentSession: vi.fn(),
  touchWritingSessionDrafts: vi.fn(),
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

  it("refuses an attachment of another type or of a draft that is not the caller's", async () => {
    await expect(
      kind.state.attach?.(caller, db, "session-1", [{ type: "post", id: 1 }])
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });

    drafts.getFeedDraft.mockResolvedValue(record(7, "someone-else"));
    await expect(
      kind.state.attach?.(caller, db, "session-1", [{ type: "draft", id: 7 }])
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(repo.touchWritingSessionDrafts).not.toHaveBeenCalled();
  });
});

describe("createWritingAgentKind runTurn", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("records every draft the turn observed, at the revision it saw", async () => {
    drafts.getFeedDraft.mockImplementation(async (_db: DB, id: number) =>
      id === 7 ? record(7) : null
    );
    const done: AgentTurnExecution<never> = {
      status: "done",
      approvals: [],
      error: undefined,
    };
    runtime.runWritingTurn.mockImplementation(async (options) => {
      // The volatile context and a tool read the draft; the host must remember revision 3.
      await options.draft.get(7);
      await options.draft.open({ feedId: 5 });
      return done;
    });
    const kind = createWritingAgentKind({
      openDraft,
      listDrafts,
      execution: {
        adminId: () => "author",
        createContentPort: () =>
          /* SAFETY: the mocked turn never calls the content port. */ ({}) as never,
        createMemoryPort: () =>
          /* SAFETY: the mocked turn never calls the memory port. */ ({}) as never,
        createWebPort: () =>
          /* SAFETY: the mocked turn never calls the web port. */ ({}) as never,
        startMemoryConsolidation: vi.fn(async () => "wf-1"),
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
});
