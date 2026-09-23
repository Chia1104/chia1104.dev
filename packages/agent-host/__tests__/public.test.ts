import { describe, expect, it, vi } from "vitest";

import type {
  ContentReadPort,
  ProfileReadPort,
} from "@chia/agent-content/types";
import { PUBLIC_AGENT_KIND } from "@chia/agent-public/models";
import { CallerTier } from "@chia/auth/tier";
import type { DB } from "@chia/db/client";

import type { AgentKindCaller } from "../src/kind";

const feeds = vi.hoisted(() => ({
  getFeedById: vi.fn(),
}));

vi.mock("@chia/db/repos/feeds", () => feeds);

const { createPublicAgentExecutor, createPublicAgentKind } =
  await import("../src/public");

/* SAFETY: the feed lookup is mocked; nothing else in the kind touches the handle. */
const db = {} as DB;

const caller: AgentKindCaller =
  /* SAFETY: `attach` ignores the caller; a guest's selection is scoped by the post's visibility. */ {
    tier: CallerTier.Guest,
    userId: "guest",
  } as AgentKindCaller;

const selectionOf = (feedId: number) => ({
  type: "selection" as const,
  text: "Selected words",
  source: { type: "feed" as const, id: feedId, locale: "en" },
});

const port: ContentReadPort = {
  searchPosts: () => Promise.resolve({ hits: [], answerable: null }),
  getPost: () => Promise.resolve(null),
  listPosts: () => Promise.resolve({ posts: [], total: 0 }),
  listTags: () => Promise.resolve([]),
};

const profile: ProfileReadPort = {
  listPublished: () => Promise.resolve([]),
};

describe("createPublicAgentKind", () => {
  const kind = createPublicAgentKind();

  it("admits guests and lists read tools plus the report, no commands and no skills", () => {
    expect(kind.kind).toBe(PUBLIC_AGENT_KIND);
    expect(kind.minTier).toBe(CallerTier.Guest);

    const capabilities = kind.capabilities();
    expect(capabilities.tools.map((tool) => tool.name)).toEqual([
      "search_posts",
      "get_post",
      "list_posts",
      "list_tags",
      "web_search",
      "fetch_url",
      "report_issue",
    ]);
    expect(
      capabilities.tools
        .filter((tool) => tool.name !== "report_issue")
        .every((tool) => tool.tier === "read")
    ).toBe(true);
    expect(capabilities.commands).toEqual([]);
    expect(capabilities.skills).toEqual([]);
  });

  /** `load` returning `null` would hide the session; a stateless kind must answer with something. */
  it("has no state row yet keeps every session visible", async () => {
    await expect(kind.state.load(db, "session-1")).resolves.toEqual({});
    await expect(kind.state.detail(db, "session-1", {})).resolves.toEqual({});
  });

  it("admits the post being read when it is published", async () => {
    feeds.getFeedById.mockResolvedValue({ id: 3 });
    await expect(
      kind.state.attach?.(caller, db, "session-1", [
        { type: "feed", id: 3, locale: "en" },
      ])
    ).resolves.toBeUndefined();
    expect(feeds.getFeedById).toHaveBeenCalledWith(db, {
      feedId: 3,
      published: true,
    });

    feeds.getFeedById.mockResolvedValue(null);
    await expect(
      kind.state.attach?.(caller, db, "session-1", [
        { type: "feed", id: 4, locale: "en" },
      ])
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("admits a selection from a published post and nothing else", async () => {
    feeds.getFeedById.mockResolvedValue({ id: 3 });
    await expect(
      kind.state.attach?.(caller, db, "session-1", [selectionOf(3)])
    ).resolves.toBeUndefined();
    expect(feeds.getFeedById).toHaveBeenCalledWith(db, {
      feedId: 3,
      published: true,
    });

    feeds.getFeedById.mockResolvedValue(null);
    await expect(
      kind.state.attach?.(caller, db, "session-1", [selectionOf(4)])
    ).rejects.toMatchObject({ code: "NOT_FOUND" });

    await expect(
      kind.state.attach?.(caller, db, "session-1", [{ type: "draft", id: 1 }])
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(
      kind.state.attach?.(caller, db, "session-1", [
        {
          type: "selection",
          text: "Selected words",
          source: {
            type: "draft",
            id: 1,
            locale: "en",
            startLine: 1,
            endLine: 1,
          },
        },
      ])
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});

const reportPort = {
  submit: () => Promise.resolve({ id: 1 }),
};

describe("createPublicAgentExecutor", () => {
  it("prepares read-only tools over the host's ports for a guest", async () => {
    const executor = createPublicAgentExecutor({
      createContentPort: () => port,
      createProfilePort: () => profile,
      guard: null,
      createWebPort: () => {
        throw new Error("web access is off in this test");
      },
      createReportPort: () => {
        throw new Error("a guest cannot report");
      },
      isSignedIn: () => Promise.resolve(false),
    });

    const turn = await executor.prepareTurn(
      /* SAFETY: the kind reads only the db handle, the owner and config from the context. */ {
        db,
        row: { id: "session-1", userId: "guest" },
        config: {},
      } as never
    );

    expect(turn.tools.map((tool) => tool.name)).toEqual([
      "search_posts",
      "get_post",
      "list_posts",
      "list_tags",
    ]);
    expect(turn.settle).toBeUndefined();
  });

  it("grants web access only to a signed-in owner, with the config on and a guard set", async () => {
    const guard = {
      id: "test-guard",
      checkMessage: () => Promise.resolve({ injection: 0, inappropriate: 0 }),
      checkDocument: () => Promise.resolve({ injection: 0 }),
    };
    const toolNames = async (options: {
      guarded: boolean;
      signedIn: boolean;
      webAccess: boolean;
    }) => {
      const executor = createPublicAgentExecutor({
        createContentPort: () => port,
        createProfilePort: () => profile,
        guard: options.guarded ? guard : null,
        createWebPort: () => ({
          search: () => Promise.resolve([]),
          fetchPage: (url) => Promise.resolve({ url, text: "" }),
        }),
        createReportPort: () => reportPort,
        isSignedIn: () => Promise.resolve(options.signedIn),
      });
      const turn = await executor.prepareTurn(
        /* SAFETY: the kind reads only the db handle, the owner and config from the context. */ {
          db,
          row: { id: "session-1", userId: "user-1" },
          config: { webAccess: options.webAccess },
        } as never
      );
      return turn.tools.map((tool) => tool.name);
    };

    await expect(
      toolNames({ guarded: true, signedIn: true, webAccess: true })
    ).resolves.toContain("web_search");
    for (const denied of [
      { guarded: false, signedIn: true, webAccess: true },
      { guarded: true, signedIn: false, webAccess: true },
      { guarded: true, signedIn: true, webAccess: false },
    ]) {
      await expect(toolNames(denied)).resolves.not.toContain("web_search");
    }
  });

  it("grants reporting to a signed-in owner, bound to them and the session", async () => {
    const createReportPort = vi.fn(() => reportPort);
    const prepare = (signedIn: boolean) =>
      createPublicAgentExecutor({
        createContentPort: () => port,
        createProfilePort: () => profile,
        guard: null,
        createWebPort: () => {
          throw new Error("web access is off in this test");
        },
        createReportPort,
        isSignedIn: () => Promise.resolve(signedIn),
      }).prepareTurn(
        /* SAFETY: the kind reads only the db handle, the owner and config from the context. */ {
          db,
          row: { id: "session-1", userId: "user-1" },
          config: {},
        } as never
      );

    const granted = await prepare(true);
    expect(granted.tools.map((tool) => tool.name)).toContain("report_issue");
    expect(createReportPort).toHaveBeenCalledWith({
      db,
      reporterId: "user-1",
      sessionId: "session-1",
    });

    createReportPort.mockClear();
    const guest = await prepare(false);
    expect(guest.tools.map((tool) => tool.name)).not.toContain("report_issue");
    expect(createReportPort).not.toHaveBeenCalled();
  });
});
