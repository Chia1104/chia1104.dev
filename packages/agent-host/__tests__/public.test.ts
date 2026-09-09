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

const { createPublicAgentKind } = await import("../src/public");

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
  searchPosts: () => Promise.resolve([]),
  getPost: () => Promise.resolve(null),
  listPosts: () => Promise.resolve([]),
  listTags: () => Promise.resolve([]),
};

const profile: ProfileReadPort = {
  listPublished: () => Promise.resolve([]),
};

describe("createPublicAgentKind", () => {
  const kind = createPublicAgentKind();

  it("admits guests and offers only read tools, no commands and no skills", () => {
    expect(kind.kind).toBe(PUBLIC_AGENT_KIND);
    expect(kind.minTier).toBe(CallerTier.Guest);

    const capabilities = kind.capabilities();
    expect(capabilities.tools.map((tool) => tool.name)).toEqual([
      "search_posts",
      "get_post",
      "list_posts",
      "list_tags",
    ]);
    expect(capabilities.tools.every((tool) => tool.tier === "read")).toBe(true);
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

  it("has no executor without an execution host", () => {
    expect(kind.runTurn).toBeUndefined();
    expect(
      createPublicAgentKind({
        execution: {
          createContentPort: () => port,
          createProfilePort: () => profile,
        },
      }).runTurn
    ).toBeTypeOf("function");
  });
});
