import { AgentHarness } from "@earendil-works/pi-agent-core";
import type {
  PromptTemplate,
  Session,
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
  AgentEngineCreateOptions,
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

  return {
    approvalRequests: gate.requests,
    async prompt(text) {
      await harness.prompt(text);
    },
    async promptFromTemplate(name, args) {
      await harness.promptFromTemplate(name, args);
    },
    async compact(customInstructions) {
      const result = await harness.compact(customInstructions);
      return { summary: result.summary, tokensBefore: result.tokensBefore };
    },
    async navigate(entryId, navigationOptions) {
      const result = await harness.navigateTree(entryId, navigationOptions);
      return { cancelled: result.cancelled };
    },
    async drainPendingMessages() {
      if (!options.pending) return 0;
      const messages = await options.pending.claim(options.agentSessionId);
      for (const message of messages) {
        if (message.kind === "steer") await harness.steer(message.text);
        else await harness.followUp(message.text);
      }
      return messages.length;
    },
    dispose() {
      for (const unsubscribe of unsubscribers) unsubscribe();
    },
  };
};
