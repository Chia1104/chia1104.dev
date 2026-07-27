import { AgentHarness } from "@earendil-works/pi-agent-core";
import type {
  PromptTemplate,
  Session,
  Skill,
} from "@earendil-works/pi-agent-core";
import type { Model, Models } from "@earendil-works/pi-ai";

import { createEventMapper } from "./events.ts";
import type { AgentWireEvent } from "./events.ts";
import { getAgentModels } from "./models.ts";
import { createToolCallGate } from "./permissions.ts";
import type { ApprovalRequest } from "./permissions.ts";
import type { PendingMessageStore } from "./ports.ts";
import type { AgentPolicy, AgentSessionSettings, AgentTool } from "./types.ts";

/**
 * Builds a configured {@link AgentHarness} for one turn of any agent kind.
 *
 * A harness is created **per turn**, not per session: the transcript lives in the session tree, so
 * the only state a harness holds across a turn boundary is its steering queues, which are only
 * meaningful while a turn is running. Constructing per turn is what keeps the runtime free of a
 * long-lived object graph that would have to survive a deploy.
 *
 * Everything kind-specific arrives as a parameter — tools, prompt, skills, templates, and a
 * {@link AgentPolicy} that classifies and gates the tools. This module has no idea what the agent
 * is for.
 */

export interface CreateAgentHarnessOptions<TContext extends object> {
  /** pi session backed by `PgSessionStorage` (or the in-memory storage in tests). */
  session: Session<any>;
  settings: AgentSessionSettings;
  /** Resolved model. Kinds own their own allowlist — see `resolveModel`. */
  model: Model<any>;
  agentSessionId: string;

  tools: AgentTool<TContext>[];
  /** Static context or a per-turn provider. pi snapshots it at turn start. */
  toolContext: TContext | (() => TContext | Promise<TContext>);
  /**
   * String, or a callback pi re-evaluates each turn. Prefer the callback when the prompt should
   * describe current state — a stale "the draft is empty" line is worse than none.
   */
  systemPrompt: string | (() => string | Promise<string>);
  skills?: Skill[];
  promptTemplates?: PromptTemplate[];

  policy: AgentPolicy;
  /** Tool call ids already approved, so a re-issued gated call goes through. */
  approvedToolCallIds?: ReadonlySet<string>;
  /** Tool names pre-authorised for this turn only. */
  preAuthorizedToolNames?: ReadonlySet<string>;

  /** Steering queue. Drained by {@link AgentHarnessHandle.drainPendingMessages}. */
  pending?: PendingMessageStore;
  /** Every wire event produced by this turn, in order. */
  onEvent: (event: AgentWireEvent) => void;
  models?: Models;
}

export interface AgentHarnessHandle<TContext extends object> {
  harness: AgentHarness<TContext>;
  /** Approval requests raised during the turn. Non-empty ⇒ the turn ended gated. */
  readonly approvalRequests: readonly ApprovalRequest[];
  /** Drains the pending-message queue into the harness. Call while a turn is running. */
  drainPendingMessages: () => Promise<number>;
  /** Detaches every subscription. Always call in a `finally`. */
  dispose: () => void;
}

export const createAgentHarness = async <TContext extends object>(
  options: CreateAgentHarnessOptions<TContext>
): Promise<AgentHarnessHandle<TContext>> => {
  const models = options.models ?? getAgentModels();
  const { policy } = options;

  const prompt = options.systemPrompt;
  const systemPrompt =
    typeof prompt === "string" ? prompt : async () => await prompt();

  /**
   * One cast, at the one place it is unavoidable.
   *
   * pi types `toolContext` through a conditional — `[TContext] extends [undefined] ? {…} : {…}` —
   * which TypeScript cannot evaluate while `TContext` is still an unresolved type parameter, even
   * though `TContext extends object` makes the `undefined` branch impossible here. Every field is
   * checked against `CreateAgentHarnessOptions` above; only the conditional is bypassed.
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

  // --- Permission gate ---
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

  // --- Event mapping ---
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

  // --- Durable-state change notification ---
  // The client refetches rather than receiving state over the wire, so a bump is enough.
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
    harness,
    approvalRequests: gate.requests,
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
