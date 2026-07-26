import { AgentHarness } from "@earendil-works/pi-agent-core";
import type { Session } from "@earendil-works/pi-agent-core";
import type { Models } from "@earendil-works/pi-ai";

import { Locale } from "@chia/db/types";

import { createEventMapper } from "./events.ts";
import type { AgentWireEvent } from "./events.ts";
import { getAgentModels, resolveModel } from "./models.ts";
import { createToolCallGate, tierOf } from "./permissions.ts";
import type { ApprovalRequest } from "./permissions.ts";
import type { DraftStore, PendingMessageStore } from "./ports.ts";
import type { ContentPort } from "./ports.ts";
import { writingSkills } from "./prompts/skills.ts";
import { buildSystemPrompt } from "./prompts/system.ts";
import { writingPromptTemplates } from "./prompts/templates.ts";
import { createWritingTools, labelOf } from "./tools/index.ts";
import { summarizeToolResult } from "./tools/summarize.ts";
import type {
  AgentSessionSettings,
  ToolTier,
  WritingToolContext,
} from "./types.ts";

/**
 * Builds a configured {@link AgentHarness} for one writing session.
 *
 * A harness is created **per turn**, not per session: the transcript lives in the session tree,
 * so the only state a harness holds across a turn boundary is its steering queues — which are
 * only meaningful while a turn is running. Constructing per turn is what keeps the runtime free
 * of a long-lived object graph that would have to survive a deploy.
 */

export interface CreateWritingHarnessOptions {
  /** pi session backed by `PgSessionStorage` (or the in-memory storage in tests). */
  session: Session<any>;
  settings: AgentSessionSettings;
  agentSessionId: string;
  adminId: string;
  targetFeedId?: number;
  content: ContentPort;
  draft: DraftStore;
  pending: PendingMessageStore;
  /** Every wire event produced by this turn, in order. */
  onEvent: (event: AgentWireEvent) => void;
  /** Tool call ids already approved, so a re-issued gated call goes through. */
  approvedToolCallIds?: ReadonlySet<string>;
  /** Tool names pre-authorised for this turn only. */
  preAuthorizedToolNames?: ReadonlySet<string>;
  models?: Models;
  /** Site default locale, surfaced in the system prompt. */
  defaultLocale?: Locale;
}

export interface WritingHarness {
  harness: AgentHarness<WritingToolContext>;
  /** Approval requests raised during the turn. Non-empty ⇒ the turn ended gated. */
  readonly approvalRequests: readonly ApprovalRequest[];
  /** Drains the pending-message queue into the harness. Call while a turn is running. */
  drainPendingMessages: () => Promise<number>;
  /** Detaches every subscription. Always call in a `finally`. */
  dispose: () => void;
}

export const createWritingHarness = async (
  options: CreateWritingHarnessOptions
): Promise<WritingHarness> => {
  const models = options.models ?? getAgentModels();
  const model = resolveModel(options.settings.modelId, models);
  const tools = createWritingTools();
  const autoApprove = options.settings.autoApprove;
  const defaultLocale = options.defaultLocale ?? Locale.zhTW;

  const toolContext: WritingToolContext = {
    agentSessionId: options.agentSessionId,
    adminId: options.adminId,
    targetFeedId: options.targetFeedId,
    content: options.content,
    draft: options.draft,
    pending: options.pending,
  };

  const harness = new AgentHarness<WritingToolContext>({
    session: options.session,
    models,
    model,
    tools,
    toolContext,
    thinkingLevel: options.settings.thinkingLevel,
    activeToolNames: options.settings.activeToolNames ?? undefined,
    resources: {
      skills: writingSkills,
      promptTemplates: writingPromptTemplates,
    },
    /**
     * Callback rather than a string: pi re-evaluates it per turn, so the draft state embedded in
     * the prompt is always current. Reads the draft on every turn, which is one cheap query
     * against a saving of one tool round-trip.
     */
    systemPrompt: async () =>
      buildSystemPrompt({
        skills: writingSkills,
        draft: await options.draft.get(options.agentSessionId),
        autoApprove,
        targetFeedId: options.targetFeedId,
        defaultLocale,
      }),
    steeringMode: "all",
    followUpMode: "all",
  });

  // --- Permission gate ---
  const gate = createToolCallGate({
    autoApprove,
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

  const unsubscribers: (() => void)[] = [];
  unsubscribers.push(harness.on("tool_call", (event) => gate.handle(event)));

  // --- Event mapping ---
  const mapEvent = createEventMapper({
    tierOf,
    labelOf,
    summarize: summarizeToolResult,
  });

  unsubscribers.push(
    harness.subscribe((event) => {
      for (const wireEvent of mapEvent(event)) options.onEvent(wireEvent);
    })
  );

  // --- Draft change notification ---
  // The client refetches the draft rather than receiving it over the wire, so a bump is enough.
  let draftRevision = 0;
  const draftMutatingTiers: ReadonlySet<ToolTier> = new Set([
    "draft",
    "commit",
  ]);
  unsubscribers.push(
    harness.on("tool_result", (event) => {
      if (!event.isError && draftMutatingTiers.has(tierOf(event.toolName))) {
        draftRevision += 1;
        options.onEvent({ type: "draft:changed", revision: draftRevision });
      }
      return undefined;
    })
  );

  return {
    harness,
    approvalRequests: gate.requests,
    async drainPendingMessages() {
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
