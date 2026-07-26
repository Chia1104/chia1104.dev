import type { Models } from "@earendil-works/pi-ai";

import { createAgentHarness } from "@chia/agent-core";
import type {
  AgentHarnessHandle,
  AgentSessionSettings,
  AgentWireEvent,
  PendingMessageStore,
  Session,
} from "@chia/agent-core";
import { Locale } from "@chia/db/types";

import { resolveWritingModel } from "./models.ts";
import { writingPolicy } from "./policy.ts";
import type { ContentPort, DraftStore } from "./ports.ts";
import { writingSkills } from "./prompts/skills.ts";
import { buildSystemPrompt } from "./prompts/system.ts";
import { writingPromptTemplates } from "./prompts/templates.ts";
import { createWritingTools } from "./tools/index.ts";
import type { WritingToolContext } from "./types.ts";

/**
 * Builds a harness for one turn of the writing agent.
 *
 * A thin wrapper over {@link createAgentHarness}: everything here is the *writing* half — the tool
 * set, the prompt, the skills, the policy and the tool context. The turn loop, the approval gate and
 * the event mapping are generic and live in `@chia/agent-core`.
 */

export interface CreateWritingHarnessOptions {
  session: Session<any>;
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

export type WritingHarness = AgentHarnessHandle<WritingToolContext>;

export const createWritingHarness = (
  options: CreateWritingHarnessOptions
): Promise<WritingHarness> => {
  const defaultLocale = options.defaultLocale ?? Locale.zhTW;

  const toolContext: WritingToolContext = {
    agentSessionId: options.agentSessionId,
    adminId: options.adminId,
    targetFeedId: options.targetFeedId,
    content: options.content,
    draft: options.draft,
  };

  return createAgentHarness<WritingToolContext>({
    session: options.session,
    settings: options.settings,
    model: resolveWritingModel(options.settings.modelId, options.models),
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
    models: options.models,
  });
};
