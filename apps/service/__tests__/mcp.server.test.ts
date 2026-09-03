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
      create: vi.fn(),
      update: vi.fn(),
    },
    agent: { sessions: { create: vi.fn(), chat: vi.fn(), get: vi.fn() } },
    ...overrides,
  }) as never;

describe("mcp server", () => {
  it("registers the content and writing tools", async () => {
    const client = await connect(fakeApi());
    const { tools } = await client.listTools();
    expect(tools.map((tool) => tool.name).sort()).toEqual([
      "create_post",
      "get_post",
      "list_posts",
      "update_post",
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

  it("nests a flat translation body under content for the contract", async () => {
    const update = vi.fn().mockResolvedValue(undefined);
    const client = await connect(fakeApi({ feeds: { update } }));

    await client.callTool({
      name: "update_post",
      arguments: {
        feedId: 7,
        published: true,
        translations: { en: { title: "Hello", content: "# Hi" } },
      },
    });

    expect(update).toHaveBeenCalledWith({
      feedId: 7,
      published: true,
      translations: { en: { title: "Hello", content: { content: "# Hi" } } },
    });
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

    expect(create).toHaveBeenCalledWith({
      kind: "writing",
      title: "catalogs",
      targetFeedId: undefined,
    });
    expect(chat).toHaveBeenCalledWith({
      kind: "writing",
      sessionId: "s1",
      action: { type: "prompt", text: "Write about pnpm catalogs" },
    });
    expect(returned).toHaveBeenCalled();
    expect(JSON.parse(textOf(result))).toMatchObject({
      sessionId: "s1",
      status: "running",
      reviewUrl: `${DASH}/agent?session=s1`,
    });
  });

  it("reports awaiting_approval ahead of the run state and the last reply", async () => {
    const get = vi.fn().mockResolvedValue({
      session: { id: "s1", title: "catalogs" },
      run: { id: "r1", status: "waiting" },
      draft: { feedMeta: { slug: "pnpm-catalogs" }, translations: {} },
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
      draft: { feedMeta: { slug: "pnpm-catalogs" } },
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
      draft: null,
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
