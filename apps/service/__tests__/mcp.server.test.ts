import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { ORPCError } from "@orpc/server";
import { describe, expect, it, vi } from "vitest";

import { createMcpServer } from "../src/mcp/server";
import type { McpApi } from "../src/mcp/server";

/** Tools are adapters; these cases pin the mapping onto procedures and the fire-and-forget turn. */

const DASH = "http://dash.test";

const connect = async (api: McpApi) => {
  const [clientTransport, serverTransport] =
    InMemoryTransport.createLinkedPair();
  const server = createMcpServer({ api, dashBaseUrl: DASH });
  await server.connect(serverTransport);
  const client = new Client({ name: "test", version: "0.0.0" });
  await client.connect(clientTransport);
  return client;
};

const textOf = (result: Awaited<ReturnType<Client["callTool"]>>) => {
  const [first] =
    /* SAFETY: Every tool answers with one text block. */ result.content as {
      type: string;
      text: string;
    }[];
  return first?.text ?? "";
};

const fakeApi = (overrides: object = {}): McpApi =>
  /* SAFETY: This fixture implements the router members the tools call. */ ({
    feeds: {
      list: vi.fn(),
      "details-by-id": vi.fn(),
      update: vi.fn(),
      "draft:list": vi.fn(),
      "draft:open": vi.fn(),
      "draft:get": vi.fn(),
      "draft:patch": vi.fn(),
      "draft:apply": vi.fn(),
    },
    agent: { sessions: { create: vi.fn(), chat: vi.fn(), get: vi.fn() } },
    ...overrides,
  }) as never;

describe("mcp server", () => {
  it("registers the content and writing tools", async () => {
    const client = await connect(fakeApi());
    const { tools } = await client.listTools();
    expect(tools.map((tool) => tool.name).sort()).toEqual([
      "apply_draft",
      "get_draft",
      "get_post",
      "list_drafts",
      "list_posts",
      "open_draft",
      "set_published",
      "update_draft",
      "write_post",
      "writing_status",
    ]);
  });

  it("lists drafts too and trims each feed to what the model needs", async () => {
    const list = vi.fn().mockResolvedValue({
      items: [
        {
          id: 7,
          slug: "hello",
          type: "post",
          published: false,
          defaultLocale: "zh-TW",
          updatedAt: "2026-09-01T00:00:00.000Z",
          translations: [
            { locale: "zh-TW", title: "哈囉", description: null, content: "x" },
          ],
        },
      ],
      nextCursor: "feed:[1,7]",
    });
    const client = await connect(fakeApi({ feeds: { list } }));

    const result = await client.callTool({
      name: "list_posts",
      arguments: { limit: 5 },
    });

    expect(list).toHaveBeenCalledWith(
      expect.objectContaining({ limit: 5, includeUnpublished: true })
    );
    expect(JSON.parse(textOf(result))).toEqual({
      items: [
        expect.objectContaining({
          id: 7,
          slug: "hello",
          translations: [{ locale: "zh-TW", title: "哈囉", description: null }],
        }),
      ],
      nextCursor: "feed:[1,7]",
    });
  });

  it("writes content through the draft and passes the revision it was given", async () => {
    const patch = vi.fn().mockResolvedValue({ id: 3, revision: 5 });
    const client = await connect(fakeApi({ feeds: { "draft:patch": patch } }));

    await client.callTool({
      name: "update_draft",
      arguments: {
        draftId: 3,
        expectedRevision: 4,
        translations: { en: { title: "Hello", content: "# Hi" } },
      },
    });

    expect(patch).toHaveBeenCalledWith({
      draftId: 3,
      expectedRevision: 4,
      translations: { en: { title: "Hello", content: "# Hi" } },
    });
  });

  it("publishes through the feed, never the draft", async () => {
    const update = vi.fn().mockResolvedValue(undefined);
    const client = await connect(fakeApi({ feeds: { update } }));

    const result = await client.callTool({
      name: "set_published",
      arguments: { feedId: 7, published: true },
    });

    expect(update).toHaveBeenCalledWith({ feedId: 7, published: true });
    expect(JSON.parse(textOf(result))).toEqual({ feedId: 7, published: true });
  });

  it("returns as soon as the writing turn has started and releases the stream", async () => {
    const returned = vi.fn();
    const events = {
      next: vi.fn().mockResolvedValue({
        done: false,
        value: { type: "run:start", sessionId: "s1" },
      }),
      return: returned,
    };
    const create = vi.fn().mockResolvedValue({ session: { id: "s1" } });
    const chat = vi.fn().mockResolvedValue(events);
    const client = await connect(
      fakeApi({ agent: { sessions: { create, chat, get: vi.fn() } } })
    );

    const result = await client.callTool({
      name: "write_post",
      arguments: { prompt: "Write about pnpm catalogs", title: "catalogs" },
    });

    expect(create).toHaveBeenCalledWith({ kind: "writing", title: "catalogs" });
    expect(chat).toHaveBeenCalledWith({
      kind: "writing",
      sessionId: "s1",
      action: {
        type: "prompt",
        text: "Write about pnpm catalogs",
        attachments: undefined,
      },
    });
    expect(returned).toHaveBeenCalled();
    expect(JSON.parse(textOf(result))).toMatchObject({
      sessionId: "s1",
      draftId: null,
      status: "running",
      reviewUrl: `${DASH}/feed/drafts?agent=open&session=s1`,
    });
  });

  it("hands a post's draft to the agent as an attachment on the prompt", async () => {
    const returned = vi.fn();
    const events = {
      next: vi.fn().mockResolvedValue({
        done: false,
        value: { type: "run:start", sessionId: "s1" },
      }),
      return: returned,
    };
    const open = vi.fn().mockResolvedValue({ id: 9 });
    const create = vi.fn().mockResolvedValue({ session: { id: "s1" } });
    const chat = vi.fn().mockResolvedValue(events);
    const client = await connect(
      fakeApi({
        feeds: { "draft:open": open },
        agent: { sessions: { create, chat, get: vi.fn() } },
      })
    );

    const result = await client.callTool({
      name: "write_post",
      arguments: { prompt: "Tighten the intro", targetFeedId: 5 },
    });

    expect(open).toHaveBeenCalledWith({ feedId: 5 });
    expect(chat).toHaveBeenCalledWith({
      kind: "writing",
      sessionId: "s1",
      action: {
        type: "prompt",
        text: "Tighten the intro",
        attachments: [{ type: "draft", id: 9 }],
      },
    });
    expect(JSON.parse(textOf(result))).toMatchObject({ draftId: 9 });
  });

  it("reports awaiting_approval ahead of the run state and the last reply", async () => {
    const get = vi.fn().mockResolvedValue({
      session: { id: "s1", title: "catalogs" },
      run: { id: "r1", status: "waiting" },
      drafts: [{ id: 9, slug: "pnpm-catalogs", revision: 2, translations: {} }],
      approvals: [
        { toolCallId: "c1", toolName: "commit_draft", status: "pending" },
        { toolCallId: "c0", toolName: "commit_draft", status: "approved" },
      ],
      events: [
        { type: "assistant:end", messageId: "m1", text: "first" },
        { type: "assistant:end", messageId: "m2", text: "Draft is ready." },
      ],
    });
    const client = await connect(
      fakeApi({
        agent: { sessions: { create: vi.fn(), chat: vi.fn(), get } },
      })
    );

    const result = await client.callTool({
      name: "writing_status",
      arguments: { sessionId: "s1" },
    });

    expect(JSON.parse(textOf(result))).toMatchObject({
      status: "awaiting_approval",
      pendingApprovals: [{ toolCallId: "c1", toolName: "commit_draft" }],
      lastReply: "Draft is ready.",
      drafts: [{ id: 9, slug: "pnpm-catalogs" }],
    });
  });

  it("reports a run parked on the message hook as idle", async () => {
    const get = vi.fn().mockResolvedValue({
      session: { id: "s1", title: null },
      run: { id: "r1", status: "waiting" },
      approvals: [],
      events: [],
    });
    const client = await connect(
      fakeApi({
        agent: { sessions: { create: vi.fn(), chat: vi.fn(), get } },
      })
    );

    const result = await client.callTool({
      name: "writing_status",
      arguments: { sessionId: "s1" },
    });

    expect(JSON.parse(textOf(result))).toMatchObject({
      status: "idle",
      drafts: [],
      lastReply: null,
    });
  });

  it("turns an oRPC error into a tool error the model can read", async () => {
    const get = vi
      .fn()
      .mockRejectedValue(new ORPCError("NOT_FOUND", { message: "gone" }));
    const client = await connect(
      fakeApi({
        agent: { sessions: { create: vi.fn(), chat: vi.fn(), get } },
      })
    );

    const result = await client.callTool({
      name: "writing_status",
      arguments: { sessionId: "nope" },
    });

    expect(result.isError).toBe(true);
    expect(textOf(result)).toBe("NOT_FOUND: gone");
  });
});
