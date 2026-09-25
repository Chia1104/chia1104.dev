import { createModels } from "@earendil-works/pi-ai";
import {
  fauxAssistantMessage,
  fauxProvider,
  fauxToolCall,
} from "@earendil-works/pi-ai/providers/faux";
import { vi } from "vitest";
import * as z from "zod";

import type { SessionEntry } from "../src/session/entries.ts";
import { InMemorySessionTree } from "../src/session/tree.ts";
import { defineTool } from "../src/tools.ts";
import type { ToolResult } from "../src/tools.ts";
import { runTurn } from "../src/turn.ts";
import type { RunTurnOptions } from "../src/turn.ts";
import type {
  AgentPolicy,
  AgentTurnBudget,
  ApprovalRequest,
} from "../src/types.ts";
import type { AgentWireEvent } from "../src/wire/schema.ts";

/**
 * `runTurn` against the real `Agent`, scripted through pi-ai's faux provider, over an
 * in-memory session tree.
 * Pins the host's side of the turn: hook composition, persistence order, abort semantics,
 * approval and compaction gating, and the wire lifecycle.
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
    () => async () => {
      calls.push("publish");
      return { text: "published", details: {} };
    }
  )({}),
  /** Blocks until the run is aborted, so a deadline can fire mid-tool. */
  defineTool(
    {
      name: "wait",
      description: "Wait forever.",
      parameters: z.object({}),
    },
    () =>
      (_params, { signal }) =>
        new Promise<ToolResult>((_resolve, reject) => {
          const fail = () => reject(new Error("aborted"));
          if (signal?.aborted) fail();
          signal?.addEventListener("abort", fail, { once: true });
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

export const toolCallTurn = (
  name: string,
  args: Parameters<typeof fauxToolCall>[1],
  id: string
) =>
  fauxAssistantMessage([fauxToolCall(name, args, { id })], {
    stopReason: "toolUse",
  });

export const sleep = (ms: number) =>
  new Promise((resolve) => setTimeout(resolve, ms));

/**
 * A branch already at the compaction threshold: ~100k tokens on a 100k window. The oversized
 * message sits behind one older turn: Pi keeps the newest ~20k tokens whole, so that turn is
 * what a compaction has to summarise. An oversized message alone would be the whole retained
 * tail.
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
    message: fauxAssistantMessage("Old answer", { timestamp: 1 }),
  });
  await session.appendEntry({
    type: "message",
    id: "entry-1",
    parentId: "entry-0-reply",
    timestamp: 1,
    message: { role: "user", content: "x".repeat(400_000), timestamp: 1 },
  });
};

export const build = (fauxOptions: { tokensPerSecond?: number } = {}) => {
  const faux = fauxProvider({
    provider: "faux",
    models: [{ id: "test-model", contextWindow: 100_000 }],
    ...fauxOptions,
  });
  const models = createModels();
  models.setProvider(faux.provider);
  const session = new InMemorySessionTree("session-1");
  const events: AgentWireEvent[] = [];
  const calls: string[] = [];
  const persistApproval = vi.fn(
    async (_approval: ApprovalRequest): Promise<void> => undefined
  );

  const options: RunTurnOptions = {
    agentSessionId: "session-1",
    session,
    settings: {
      providerId: "faux",
      modelId: "test-model",
      thinkingLevel: "off",
      activeToolNames: null,
      autoApprove: [],
    },
    model: faux.getModel(),
    models,
    tools: createTools(calls),
    systemPrompt: "You are a test.",
    policy,
    budget,
    message: { text: "Hello" },
    onEvent: (event) => events.push(event),
    persistApproval,
  };

  return {
    faux,
    session,
    events,
    calls,
    persistApproval,
    options,
    types: () =>
      events
        .map((event) => event.type)
        .filter((type) => type !== "assistant:delta"),
    branch: () => session.getBranch(),
    run: (overrides: Partial<RunTurnOptions> = {}) =>
      runTurn({ ...options, ...overrides }),
  };
};

export const messageOf = (entry: SessionEntry | undefined) =>
  entry?.type === "message" ? entry.message : undefined;

export const assistantUsageOf = (entry: SessionEntry | undefined) => {
  const message = messageOf(entry);
  return message?.role === "assistant" ? message.usage : undefined;
};
