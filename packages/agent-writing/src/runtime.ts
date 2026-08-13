import type { Models } from "@earendil-works/pi-ai";

import {
  compactPiSession,
  createAgentModels,
  navigatePiSession,
  runPiTurn,
} from "@chia/agent-runtime";
import type {
  AgentCompactionResult,
  AgentNavigationOptions,
  AgentNavigationResult,
  AgentSessionSettings,
  AgentTurnExecution,
  AgentTurnMessage,
  AgentWireEvent,
  ApprovalRequest,
  PendingMessageNotifier,
  PendingMessageStore,
  Session,
} from "@chia/agent-runtime";
import { Locale } from "@chia/db/types";

import { resolveWritingModel } from "./models.ts";
import { writingPolicy } from "./policy.ts";
import type { ContentPort, DraftStore } from "./ports.ts";
import { writingSkills } from "./prompts/skills.ts";
import { buildSystemPrompt } from "./prompts/system.ts";
import { writingPromptTemplates } from "./prompts/templates.ts";
import { createWritingTools } from "./tools/index.ts";
import type { WritingToolContext } from "./types.ts";

export interface RunWritingTurnOptions<TApproval> {
  session: Session;
  settings: AgentSessionSettings;
  agentSessionId: string;
  adminId: string;
  targetFeedId?: number;
  content: ContentPort;
  draft: DraftStore;
  pending?: PendingMessageStore;
  pendingNotifier?: PendingMessageNotifier;
  message: AgentTurnMessage;
  onEvent: (event: AgentWireEvent) => void;
  approvedToolCallIds?: ReadonlySet<string>;
  preAuthorizedToolNames?: ReadonlySet<string>;
  models?: Models;
  defaultLocale?: Locale;
  toApproval: (request: ApprovalRequest) => TApproval;
  persistApproval: (approval: TApproval) => Promise<void>;
  flushEvents?: () => Promise<void>;
  drainIntervalMs?: number;
}

/** Composes the writing domain and executes one turn on Pi's concrete runtime. */
export const runWritingTurn = <TApproval>(
  options: RunWritingTurnOptions<TApproval>
): Promise<AgentTurnExecution<TApproval>> => {
  const defaultLocale = options.defaultLocale ?? Locale.zhTW;
  const models = options.models ?? createAgentModels();
  const toolContext: WritingToolContext = {
    agentSessionId: options.agentSessionId,
    adminId: options.adminId,
    targetFeedId: options.targetFeedId,
    content: options.content,
    draft: options.draft,
  };

  return runPiTurn({
    agentSessionId: options.agentSessionId,
    session: options.session,
    settings: options.settings,
    model: resolveWritingModel(options.settings, models),
    models,
    tools: createWritingTools(),
    toolContext,
    systemPrompt: async () =>
      buildSystemPrompt({
        skills: writingSkills,
        draft: await options.draft.get(options.agentSessionId),
        autoApprove: options.settings.autoApprove,
        targetFeedId: options.targetFeedId,
        defaultLocale,
      }),
    skills: writingSkills,
    promptTemplates: writingPromptTemplates,
    policy: writingPolicy,
    approvedToolCallIds: options.approvedToolCallIds,
    preAuthorizedToolNames: options.preAuthorizedToolNames,
    pending: options.pending,
    pendingNotifier: options.pendingNotifier,
    message: options.message,
    onEvent: options.onEvent,
    toApproval: options.toApproval,
    persistApproval: options.persistApproval,
    flushEvents: options.flushEvents,
    drainIntervalMs: options.drainIntervalMs,
  });
};

export interface WritingSessionOperationOptions {
  session: Session;
  settings: AgentSessionSettings;
  models?: Models;
}

/** Compacts a writing session with its model allowlist and caller-owned credentials. */
export const compactWritingSession = (
  options: WritingSessionOperationOptions,
  customInstructions?: string
): Promise<AgentCompactionResult> => {
  const models = options.models ?? createAgentModels();
  return compactPiSession(
    {
      session: options.session,
      settings: options.settings,
      model: resolveWritingModel(options.settings, models),
      models,
    },
    customInstructions
  );
};

/** Navigates a writing session with its model allowlist and caller-owned credentials. */
export const navigateWritingSession = (
  options: WritingSessionOperationOptions,
  entryId: string,
  navigationOptions: AgentNavigationOptions
): Promise<AgentNavigationResult> => {
  const models = options.models ?? createAgentModels();
  return navigatePiSession(
    {
      session: options.session,
      settings: options.settings,
      model: resolveWritingModel(options.settings, models),
      models,
    },
    entryId,
    navigationOptions
  );
};
