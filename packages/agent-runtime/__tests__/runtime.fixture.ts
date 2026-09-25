import type { ModelMessage } from "@tanstack/ai";
import { vi } from "vitest";
import * as z from "zod";

import type { JsonObject } from "@chia/utils/json";

import type { AssistantMessage } from "../src/messages.ts";
import { emptyUsage } from "../src/messages.ts";
import type { SessionEntry } from "../src/session/entries.ts";
import { InMemorySessionTree } from "../src/session/tree.ts";
import { bindingOf, scriptedAdapter } from "../src/testing.ts";
import type { ScriptedReply } from "../src/testing.ts";
import { defineTool } from "../src/tools.ts";
import { runTurn } from "../src/turn.ts";
import type { RunTurnOptions } from "../src/turn.ts";
import type { ApprovalBatch } from "../src/types.ts";
import type { AgentPolicy, AgentTurnBudget } from "../src/types.ts";
import type { AgentWireEvent } from "../src/wire/schema.ts";

/**
 * `runTurn` against the real engine, scripted through an adapter that plays back replies, over an
 * in-memory session tree. Pins the host's side of the turn: hook composition, persistence order,
 * abort semantics, approval and compaction gating, and the wire lifecycle.
 */

export const createTools = (calls: string[]) => [
  defineTool(
    {
      name: "search",
      description: "Search posts.",
      parameters: z.object({ q: z.string() }),
    },
    () => async (params) => {
      calls.push(params.q);
      return { text: `results for ${params.q}`, details: { q: params.q } };
    }
  )({}),
  defineTool(
    {
      name: "publish",
      description: "Publish a post.",
      parameters: z.object({ slug: z.string().optional() }),
    },
    () => async (params) => {
      calls.push(`publish:${params.slug ?? ""}`);
      return { text: "published", details: {} };
    }
  )({}),
  /** Blocks until the turn is aborted, so a deadline can fire mid-tool. */
  defineTool(
    {
      name: "wait",
      description: "Wait forever.",
      parameters: z.object({}),
    },
    () => (_params, call) =>
      new Promise((_resolve, reject) => {
        const fail = () => reject(new Error("aborted"));
        if (call.signal?.aborted) fail();
        call.signal?.addEventListener("abort", fail, { once: true });
      })
  )({}),
];

export const policy: AgentPolicy = {
  toolInfo: (toolName) => ({
    label: toolName,
    tier: toolName === "publish" ? "commit" : "read",
  }),
  requiresApproval: (tier) => tier === "commit",
  summarize: () => "",
};

export const budget: AgentTurnBudget = {
  maxToolCalls: 3,
  hardMaxToolCalls: 5,
  maxRepeats: 2,
  maxDurationMs: 60_000,
};

export const toolCall = (
  name: string,
  args: JsonObject,
  id: string
): ScriptedReply => ({ toolCalls: [{ id, name, args }] });

export const sleep = (ms: number) =>
  new Promise((resolve) => setTimeout(resolve, ms));

export const assistantMessage = (
  text: string,
  timestamp = 1
): AssistantMessage => ({
  role: "assistant",
  content: [{ type: "text", text }],
  api: "scripted",
  provider: "scripted",
  model: "test-model",
  usage: emptyUsage(),
  stopReason: "stop",
  timestamp,
});

/**
 * A branch already at the compaction threshold: ~100k tokens on a 100k window. A turn run on it
 * leaves the oversized message and the older turn behind it outside the newest ~20k tokens, so a
 * compaction has something to summarise.
 */
export const seedOversizedBranch = async (session: InMemorySessionTree) => {
  await session.appendEntry({
    type: "message",
    id: "entry-0",
    parentId: null,
    timestamp: 1,
    message: { role: "user", content: "Old question", timestamp: 1 },
  });
  await session.appendEntry({
    type: "message",
    id: "entry-0-reply",
    parentId: "entry-0",
    timestamp: 1,
    message: assistantMessage("Old answer"),
  });
  await session.appendEntry({
    type: "message",
    id: "entry-1",
    parentId: "entry-0-reply",
    timestamp: 1,
    message: { role: "user", content: "x".repeat(400_000), timestamp: 1 },
  });
};

export const build = (replies: readonly ScriptedReply[] = []) => {
  const script = scriptedAdapter(replies);
  const session = new InMemorySessionTree("session-1");
  const events: AgentWireEvent[] = [];
  const calls: string[] = [];
  const persistApprovals = vi.fn(
    async (_batch: ApprovalBatch): Promise<void> => undefined
  );

  const options = {
    agentSessionId: "session-1",
    agentRunId: "run-1",
    session,
    settings: {
      providerId: "scripted",
      modelId: "test-model",
      thinkingLevel: "off",
      activeToolNames: null,
      autoApprove: [],
    },
    binding: bindingOf(script),
    tools: createTools(calls),
    systemPrompt: "You are a test.",
    policy,
    budget,
    message: { text: "Hello" },
    onEvent: (event: AgentWireEvent) => events.push(event),
    persistApprovals,
  } satisfies RunTurnOptions;

  return {
    script,
    session,
    events,
    calls,
    persistApprovals,
    options,
    types: () =>
      events
        .map((event) => event.type)
        .filter((type) => type !== "assistant:delta"),
    branch: () => session.getBranch(),
    run: (overrides: Partial<RunTurnOptions> = {}) =>
      // SAFETY: an override replaces the message with a resume or keeps the base message; the
      // union is re-established by whichever the caller passed.
      runTurn({ ...options, ...overrides } as RunTurnOptions),
    /** The provider messages the engine sent on request `index`. */
    sent: (index: number): ModelMessage[] =>
      script.requests[index]?.messages ?? [],
  };
};

export const messageOf = (entry: SessionEntry | undefined) =>
  entry?.type === "message" ? entry.message : undefined;

export const assistantUsageOf = (entry: SessionEntry | undefined) => {
  const message = messageOf(entry);
  return message?.role === "assistant" ? message.usage : undefined;
};
