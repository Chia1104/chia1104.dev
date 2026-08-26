import type { Models } from "@earendil-works/pi-ai";

import { createAgentModels } from "@chia/agent-runtime/models";
import {
  compactPiSession,
  navigatePiSession,
} from "@chia/agent-runtime/pi/maintenance";
import type { ApprovalRequest } from "@chia/agent-runtime/pi/tool-gate";
import { runPiTurn } from "@chia/agent-runtime/pi/turn";
import type { SessionTree } from "@chia/agent-runtime/session/tree";
import type {
  AgentCompactionResult,
  AgentNavigationOptions,
  AgentNavigationResult,
  AgentSessionSettings,
  AgentTurnExecution,
  AgentTurnMessage,
} from "@chia/agent-runtime/types";
import type { AgentWireEvent } from "@chia/agent-runtime/wire/schema";
import { Locale } from "@chia/db/types";

import { resolveWritingModel } from "./models.ts";
import { writingPolicy, writingTurnBudget } from "./policy.ts";
import type { ContentPort, DraftStore, MemoryPort, WebPort } from "./ports.ts";
import { writingSkills } from "./prompts/skills.ts";
import { buildSystemPrompt, buildTurnContext } from "./prompts/system.ts";
import { writingPromptTemplates } from "./prompts/templates.ts";
import { createWritingTools } from "./tools/tool-set.ts";
import type { WritingToolContext } from "./types.ts";

export interface RunWritingTurnOptions<TApproval> {
  session: SessionTree;
  settings: AgentSessionSettings;
  agentSessionId: string;
  targetFeedId?: number;
  content: ContentPort;
  web: WebPort;
  draft: DraftStore;
  memory: MemoryPort;
  message: AgentTurnMessage;
  onEvent: (event: AgentWireEvent) => void;
  approvedToolCallIds?: ReadonlySet<string>;
  preAuthorizedToolNames?: ReadonlySet<string>;
  /** Host-owned abort; see `RunPiTurnOptions.signal`. */
  signal?: AbortSignal;
  models?: Models;
  defaultLocale?: Locale;
  toApproval: (request: ApprovalRequest) => TApproval;
  persistApprovals: (approvals: readonly TApproval[]) => Promise<void>;
  flushEvents?: () => Promise<void>;
}

/** Composes the writing domain and executes one turn on Pi's `Agent`. */
export const runWritingTurn = <TApproval>(
  options: RunWritingTurnOptions<TApproval>
): Promise<AgentTurnExecution<TApproval>> => {
  const defaultLocale = options.defaultLocale ?? Locale.zhTW;
  const models = options.models ?? createAgentModels();
  const toolContext: WritingToolContext = {
    agentSessionId: options.agentSessionId,
    targetFeedId: options.targetFeedId,
    content: options.content,
    web: options.web,
    draft: options.draft,
    memory: options.memory,
  };

  return runPiTurn({
    agentSessionId: options.agentSessionId,
    session: options.session,
    settings: options.settings,
    model: resolveWritingModel(options.settings, models),
    models,
    tools: createWritingTools(),
    toolContext,
    systemPrompt: buildSystemPrompt({
      skills: writingSkills,
      autoApprove: options.settings.autoApprove,
    }),
    volatileContext: async () =>
      buildTurnContext({
        draft: await options.draft.get(options.agentSessionId),
        targetFeedId: options.targetFeedId,
        defaultLocale,
        now: new Date(),
      }),
    signal: options.signal,
    promptTemplates: writingPromptTemplates,
    policy: writingPolicy,
    budget: writingTurnBudget,
    approvedToolCallIds: options.approvedToolCallIds,
    preAuthorizedToolNames: options.preAuthorizedToolNames,
    message: options.message,
    onEvent: options.onEvent,
    toApproval: options.toApproval,
    persistApprovals: options.persistApprovals,
    flushEvents: options.flushEvents,
  });
};

export interface WritingSessionOperationOptions {
  session: SessionTree;
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
