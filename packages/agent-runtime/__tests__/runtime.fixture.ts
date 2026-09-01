import type { AgentToolResult } from "@earendil-works/pi-agent-core";
import { createModels } from "@earendil-works/pi-ai";
import {
  fauxAssistantMessage,
  fauxProvider,
  fauxToolCall,
} from "@earendil-works/pi-ai/providers/faux";
import { vi } from "vitest";

import { runPiTurn } from "../src/pi/turn.ts";
import type { RunPiTurnOptions } from "../src/pi/turn.ts";
import type { SessionEntry } from "../src/session/entries.ts";
import { InMemorySessionTree } from "../src/session/tree.ts";
import { textResult, toolDefiner, Type } from "../src/tools.ts";
import type { AgentPolicy, AgentTurnBudget } from "../src/types.ts";
import type { AgentWireEvent } from "../src/wire/schema.ts";

/**
 * `runPiTurn` against the real `Agent`, scripted through pi-ai's faux provider, over an
 * in-memory session tree.
 * Pins the host's side of the turn: hook composition, persistence order, abort semantics,
 * approval and compaction gating, and the wire lifecycle.
 */

export interface TestContext {
  calls: string[];
}

const define = toolDefiner<TestContext>();

export const searchTool = define({
  name: "search",
  label: "Search",
  description: "Search posts.",
  parameters: Type.Object({ q: Type.String() }),
  execute: async (_toolCallId, params, _signal, _onUpdate, context) => {
    context.calls.push(params.q);
    return textResult(`results for ${params.q}`, { q: params.q });
  },
});

export const publishTool = define({
  name: "publish",
  label: "Publish",
  description: "Publish a post.",
  parameters: Type.Object({ slug: Type.Optional(Type.String()) }),
  execute: async (_toolCallId, _params, _signal, _onUpdate, context) => {
    context.calls.push("publish");
    return textResult("published", {});
  },
});

/** Blocks until the run is aborted, so a deadline can fire mid-tool. */
export const waitTool = define({
  name: "wait",
  label: "Wait",
  description: "Wait forever.",
  parameters: Type.Object({}),
  execute: (_toolCallId, _params, signal) =>
    new Promise<AgentToolResult<unknown>>((_resolve, reject) => {
      const fail = () => reject(new Error("aborted"));
      if (signal?.aborted) fail();
      signal?.addEventListener("abort", fail, { once: true });
    }),
});

export const policy: AgentPolicy = {
  tierOf: (toolName) => (toolName === "publish" ? "commit" : "read"),
  labelOf: (toolName) => toolName,
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
  const context: TestContext = { calls: [] };
  const persistApprovals = vi.fn(
    async (_approvals: readonly string[]): Promise<void> => undefined
  );

  const options: RunPiTurnOptions<TestContext, string> = {
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
    tools: [searchTool, publishTool, waitTool],
    toolContext: context,
    systemPrompt: "You are a test.",
    policy,
    budget,
    message: { text: "Hello" },
    onEvent: (event) => events.push(event),
    toApproval: (approval) => approval.toolCallId,
    persistApprovals,
  };

  return {
    faux,
    session,
    events,
    context,
    persistApprovals,
    options,
    types: () =>
      events
        .map((event) => event.type)
        .filter((type) => type !== "assistant:delta"),
    branch: () => session.getBranch(),
    run: (overrides: Partial<RunPiTurnOptions<TestContext, string>> = {}) =>
      runPiTurn({ ...options, ...overrides }),
  };
};

export const messageOf = (entry: SessionEntry | undefined) =>
  entry?.type === "message" ? entry.message : undefined;

export const assistantUsageOf = (entry: SessionEntry | undefined) => {
  const message = messageOf(entry);
  return message?.role === "assistant" ? message.usage : undefined;
};
