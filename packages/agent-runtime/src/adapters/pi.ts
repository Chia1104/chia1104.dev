import {
  AgentHarness,
  DEFAULT_COMPACTION_SETTINGS,
  estimateContextTokens,
  shouldCompact,
} from "@earendil-works/pi-agent-core";
import type {
  PromptTemplate,
  Session,
  SessionTreeEntry,
  Skill,
} from "@earendil-works/pi-agent-core";
import type { Api, Model, Models } from "@earendil-works/pi-ai";

import {
  createEventMapper,
  createToolCallGate,
  getAgentModels,
} from "@chia/agent-core";
import type {
  AgentPolicy,
  AgentSessionSettings,
  AgentTool,
  PendingMessageStore,
} from "@chia/agent-core";

import type {
  AgentCompactionResult,
  AgentEngineCreateOptions,
  AgentMaintenanceCreateOptions,
  AgentMaintenanceEngineHandle,
  AgentNavigationOptions,
} from "../engine.ts";

export interface CreatePiAgentEngineOptions<
  TContext extends object,
> extends AgentEngineCreateOptions {
  /** pi session backed by `PgSessionStorage` (or the in-memory storage in tests). */
  session: Session;
  settings: AgentSessionSettings;
  /** Resolved model. Kinds own their own allowlist — see `resolveModel`. */
  model: Model<Api>;
  tools: AgentTool<TContext>[];
  /** Static context or a per-turn provider. pi snapshots it at turn start. */
  toolContext: TContext | (() => TContext | Promise<TContext>);
  /**
   * String, or a callback pi re-evaluates each turn. Prefer the callback when the prompt should
   * describe current state.
   */
  systemPrompt: string | (() => string | Promise<string>);
  skills?: Skill[];
  promptTemplates?: PromptTemplate[];
  policy: AgentPolicy;
  approvedToolCallIds?: ReadonlySet<string>;
  preAuthorizedToolNames?: ReadonlySet<string>;
  pending?: PendingMessageStore;
  models?: Models;
}

export interface PiAgentEngineHandle extends AgentMaintenanceEngineHandle {
  compact: (
    customInstructions?: string
  ) => Promise<{ summary: string; tokensBefore: number }>;
  navigate: (
    entryId: string,
    options: AgentNavigationOptions
  ) => Promise<{ cancelled: boolean }>;
}

/**
 * Whether a branch has grown past the point where the next turn should be given a fresh context.
 *
 * `estimateContextTokens` prefers the last assistant message's provider-reported usage — which is
 * authoritative, and already accounts for a preceding compaction's summary and retained tail — and
 * adds a character estimate for everything after it. It only falls back to pure estimation when no
 * assistant message has replied yet, which is precisely when compaction cannot apply anyway.
 *
 * Exported for tests: this is the one piece of judgement the adapter adds, and it is worth pinning
 * down without standing up a harness and a provider.
 */
export const shouldCompactBranch = (
  entries: SessionTreeEntry[],
  contextWindow: number
): boolean => {
  const messages = entries
    .filter((entry) => entry.type === "message")
    .map((entry) => entry.message);
  if (messages.length === 0) return false;
  const { tokens } = estimateContextTokens(messages);
  return shouldCompact(tokens, contextWindow, DEFAULT_COMPACTION_SETTINGS);
};

/** Shared by both handles so a single threshold governs turn and maintenance paths alike. */
const compactIfNeededWith =
  (
    session: Session,
    contextWindow: number,
    compact: () => Promise<AgentCompactionResult>
  ) =>
  async (): Promise<AgentCompactionResult | null> => {
    const entries = await session.getBranch();
    if (!shouldCompactBranch(entries, contextWindow)) return null;
    return await compact();
  };

/**
 * pi implementation of the runtime-neutral agent engine.
 *
 * The concrete `AgentHarness` never escapes this adapter. Consumers depend on
 * {@link AgentEngineHandle}, so another adapter can replace pi without changing the turn runner.
 */
export const createPiAgentEngine = async <TContext extends object>(
  options: CreatePiAgentEngineOptions<TContext>
): Promise<PiAgentEngineHandle> => {
  const models = options.models ?? getAgentModels();
  const { policy } = options;
  const prompt = options.systemPrompt;
  const systemPrompt =
    typeof prompt === "string" ? prompt : async () => await prompt();

  /**
   * pi types `toolContext` through a conditional TypeScript cannot evaluate while `TContext`
   * remains unresolved. The options interface checks every field; only that conditional is
   * bypassed here.
   */
  const harness = new AgentHarness({
    session: options.session,
    models,
    model: options.model,
    tools: options.tools,
    toolContext: options.toolContext,
    thinkingLevel: options.settings.thinkingLevel,
    activeToolNames: options.settings.activeToolNames ?? undefined,
    resources: {
      skills: options.skills,
      promptTemplates: options.promptTemplates,
    },
    systemPrompt,
    steeringMode: "all",
    followUpMode: "all",
  } as never) as AgentHarness<TContext>;

  const unsubscribers: (() => void)[] = [];
  const gate = createToolCallGate({
    policy,
    autoApprove: options.settings.autoApprove,
    approvedToolCallIds: options.approvedToolCallIds,
    preAuthorizedToolNames: options.preAuthorizedToolNames,
    onApprovalRequired: (request) =>
      options.onEvent({
        type: "approval:request",
        toolCallId: request.toolCallId,
        toolName: request.toolName,
        tier: request.tier,
        args: request.args,
      }),
  });
  unsubscribers.push(harness.on("tool_call", (event) => gate.handle(event)));

  const mapEvent = createEventMapper({
    tierOf: policy.tierOf,
    labelOf: policy.labelOf,
    summarize: policy.summarize,
  });
  unsubscribers.push(
    harness.subscribe((event) => {
      for (const wireEvent of mapEvent(event)) options.onEvent(wireEvent);
    })
  );

  if (policy.changesState) {
    let revision = 0;
    unsubscribers.push(
      harness.on("tool_result", (event) => {
        if (
          !event.isError &&
          policy.changesState?.(policy.tierOf(event.toolName))
        ) {
          revision += 1;
          options.onEvent({
            type: "state:changed",
            scope: policy.stateScope,
            revision,
          });
        }
        return undefined;
      })
    );
  }

  const compact = async (
    customInstructions?: string
  ): Promise<AgentCompactionResult> => {
    const result = await harness.compact(customInstructions);
    return { summary: result.summary, tokensBefore: result.tokensBefore };
  };

  return {
    approvalRequests: gate.requests,
    async prompt(text) {
      await harness.prompt(text);
    },
    async promptFromTemplate(name, args) {
      await harness.promptFromTemplate(name, args);
    },
    compact,
    compactIfNeeded: compactIfNeededWith(
      options.session,
      options.model.contextWindow,
      () => compact()
    ),
    async navigate(entryId, navigationOptions) {
      const result = await harness.navigateTree(entryId, navigationOptions);
      return { cancelled: result.cancelled };
    },
    /**
     * Hands claimed messages to the harness, putting back anything it refuses.
     *
     * `claim` marks rows consumed before delivery, so a throw here used to lose them outright. The
     * common throw is pi's `"Cannot steer while idle"`, which happens when the turn finishes
     * between the claim and the delivery. Releasing means the message survives to the *next* turn
     * instead — a steer aimed at turn N surfacing in turn N+1 reads slightly oddly, but it beats
     * the operator's message vanishing with no trace.
     */
    async drainPendingMessages() {
      const store = options.pending;
      if (!store) return 0;
      const messages = await store.claim(options.agentSessionId);
      const undelivered = [...messages];
      try {
        for (const message of messages) {
          if (message.kind === "steer") await harness.steer(message.text);
          else await harness.followUp(message.text);
          undelivered.shift();
        }
      } catch (error) {
        // Best effort: if the release itself fails there is nothing left to try.
        await store
          .release(undelivered.map((message) => message.id))
          .catch(() => undefined);
        throw error;
      }
      return messages.length;
    },
    dispose() {
      for (const unsubscribe of unsubscribers) unsubscribe();
    },
  };
};

export interface CreatePiMaintenanceEngineOptions extends AgentMaintenanceCreateOptions {
  /** Resolved model. Only the summarisation calls and the context-window threshold use it. */
  model: Model<Api>;
  models?: Models;
}

const maintenanceOnly = (method: string): never => {
  throw new Error(
    `${method} is unavailable on a maintenance engine. Build a turn engine instead.`
  );
};

/**
 * pi implementation of a session-tree maintenance handle.
 *
 * Deliberately *not* a configuration of {@link createPiAgentEngine}: compaction and branch
 * navigation need a session and a model, and nothing else. Tools, skills, prompt templates, the
 * agent system prompt, the approval gate and the event subscriptions all exist to serve a turn, and
 * building them here only to discard their output is waste that also invites the mistake of
 * treating this handle as one that can run a turn. Compaction uses pi's own
 * `SUMMARIZATION_SYSTEM_PROMPT` and branch summaries use `generateBranchSummary`, so neither reads
 * the agent's system prompt.
 *
 * The two harness constructions are kept separate rather than funnelled through a shared builder:
 * they differ in almost every field, and a builder covering both would be a thicket of optionals.
 */
export const createPiMaintenanceEngine = async (
  options: CreatePiMaintenanceEngineOptions
): Promise<AgentMaintenanceEngineHandle> => {
  const harness = new AgentHarness({
    session: options.session,
    models: options.models ?? getAgentModels(),
    model: options.model,
    tools: [],
    thinkingLevel: options.settings.thinkingLevel,
    systemPrompt: "",
  } as never) as AgentHarness;

  const compact = async (
    customInstructions?: string
  ): Promise<AgentCompactionResult> => {
    const result = await harness.compact(customInstructions);
    return { summary: result.summary, tokensBefore: result.tokensBefore };
  };

  return {
    approvalRequests: [],
    prompt: () => maintenanceOnly("prompt"),
    promptFromTemplate: () => maintenanceOnly("promptFromTemplate"),
    compact,
    compactIfNeeded: compactIfNeededWith(
      options.session,
      options.model.contextWindow,
      () => compact()
    ),
    async navigate(entryId, navigationOptions) {
      const result = await harness.navigateTree(entryId, navigationOptions);
      return { cancelled: result.cancelled };
    },
    // No pending-message store: a maintenance handle never runs a turn to drain them into.
    drainPendingMessages: async () => 0,
    dispose: () => undefined,
  };
};
