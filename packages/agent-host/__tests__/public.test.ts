import { describe, expect, it } from "vitest";

import type {
  ContentReadPort,
  ProfileReadPort,
} from "@chia/agent-content/types";
import { PUBLIC_AGENT_KIND } from "@chia/agent-public/models";
import type { DB } from "@chia/db/client";
import { CallerTier } from "@chia/service-kit/policies/caller.policy";

import { createPublicAgentKind } from "../src/public";

/* SAFETY: the public kind keeps no row, so its state methods never touch the handle. */
const db = {} as DB;

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

  it("is root-only and offers only read tools, no commands and no skills", () => {
    expect(kind.kind).toBe(PUBLIC_AGENT_KIND);
    expect(kind.minTier).toBe(CallerTier.Root);

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
    expect(kind.state.summary({})).toEqual({});
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
