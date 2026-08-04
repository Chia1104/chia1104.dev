import type { Models } from "@earendil-works/pi-ai";

import { createAgentModels } from "@chia/agent-core";
import type {
  AgentSessionSettings,
  AgentWireEvent,
  PendingMessageStore,
  Session,
} from "@chia/agent-core";
import { createAgentRuntime } from "@chia/agent-runtime";
import type {
  AgentDefinition,
  AgentMaintenanceCreateOptions,
  AgentMaintenanceEngineHandle,
} from "@chia/agent-runtime";
import {
  createPiAgentEngine,
  createPiMaintenanceEngine,
} from "@chia/agent-runtime/adapters/pi";
import { Locale } from "@chia/db/types";

import { resolveWritingModel, WRITING_AGENT_KIND } from "./models.ts";
import { writingPolicy } from "./policy.ts";
import type { ContentPort, DraftStore } from "./ports.ts";
import { writingSkills } from "./prompts/skills.ts";
import { buildSystemPrompt } from "./prompts/system.ts";
import { writingPromptTemplates } from "./prompts/templates.ts";
import { createWritingTools } from "./tools/index.ts";
import type { WritingToolContext } from "./types.ts";

/**
 * Builds an engine handle for one turn of the writing agent.
 *
 * A thin wrapper over the pi adapter: everything here is the *writing* half — the tool set, prompt,
 * skills, policy and tool context. The turn lifecycle and provider adapter live in
 * `@chia/agent-runtime`; approval and event primitives live in `@chia/agent-core`.
 */

export interface CreateWritingEngineOptions {
  session: Session;
  settings: AgentSessionSettings;
  agentSessionId: string;
  adminId: string;
  targetFeedId?: number;
  content: ContentPort;
  draft: DraftStore;
  pending?: PendingMessageStore;
  onEvent: (event: AgentWireEvent) => void;
  approvedToolCallIds?: ReadonlySet<string>;
  preAuthorizedToolNames?: ReadonlySet<string>;
  models?: Models;
  /** Site default locale, surfaced in the system prompt. */
  defaultLocale?: Locale;
}

export type WritingEngine = AgentMaintenanceEngineHandle;

export const createWritingEngine = (
  options: CreateWritingEngineOptions
): Promise<WritingEngine> => {
  const defaultLocale = options.defaultLocale ?? Locale.zhTW;
  const models = options.models ?? createAgentModels();

  const toolContext: WritingToolContext = {
    agentSessionId: options.agentSessionId,
    adminId: options.adminId,
    targetFeedId: options.targetFeedId,
    content: options.content,
    draft: options.draft,
  };

  return createPiAgentEngine<WritingToolContext>({
    session: options.session,
    settings: options.settings,
    model: resolveWritingModel(options.settings, models),
    models,
    agentSessionId: options.agentSessionId,
    tools: createWritingTools(),
    toolContext,
    /**
     * A callback, not a string: pi re-evaluates it per turn, so the draft state embedded in the
     * prompt is always current. Costs one cheap query, saves a tool round-trip.
     */
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
    onEvent: options.onEvent,
  });
};

export interface CreateWritingMaintenanceEngineOptions extends AgentMaintenanceCreateOptions {
  models?: Models;
}

/**
 * Compaction and rewind for a writing session.
 *
 * The writing half collapses to one line here — resolving the model — because neither operation
 * touches tools, skills, the draft, or the system prompt. That is the whole point of the separate
 * factory: the previous path built all of them and then threw their events away.
 */
export const createWritingMaintenanceEngine = (
  options: CreateWritingMaintenanceEngineOptions
): Promise<AgentMaintenanceEngineHandle> => {
  const models = options.models ?? createAgentModels();
  return createPiMaintenanceEngine({
    agentSessionId: options.agentSessionId,
    session: options.session,
    settings: options.settings,
    model: resolveWritingModel(options.settings, models),
    models,
  });
};

export const writingAgentDefinition = {
  kind: WRITING_AGENT_KIND,
  createEngine: createWritingEngine,
  createMaintenanceEngine: createWritingMaintenanceEngine,
} satisfies AgentDefinition<CreateWritingEngineOptions, WritingEngine>;

/** Shared turn lifecycle plus the writing agent's pi engine factory. */
export const writingAgentRuntime = createAgentRuntime(writingAgentDefinition);
