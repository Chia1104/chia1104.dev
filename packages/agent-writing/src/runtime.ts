import type { Api, Model, Models } from "@earendil-works/pi-ai";

import { createAgentModels } from "@chia/agent-runtime/models";
import type { ApprovalRequest } from "@chia/agent-runtime/pi/tool-gate";
import { runPiTurn } from "@chia/agent-runtime/pi/turn";
import type { SessionTree } from "@chia/agent-runtime/session/tree";
import type {
  AgentSessionSettings,
  AgentTurnExecution,
  AgentTurnMessage,
  AgentUsageListener,
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
  /** The operator's standing instructions; see `SystemPromptInput.instructions`. */
  instructions?: string;
  message: AgentTurnMessage;
  onEvent: (event: AgentWireEvent) => void;
  approvedToolCallIds?: ReadonlySet<string>;
  preAuthorizedToolNames?: ReadonlySet<string>;
  /** Host-owned abort; see `RunPiTurnOptions.signal`. */
  signal?: AbortSignal;
  models?: Models;
  /** See `RunPiTurnOptions.compactionModel`; the session's own model when omitted. */
  compactionModel?: Model<Api>;
  defaultLocale?: Locale;
  toApproval: (request: ApprovalRequest) => TApproval;
  persistApprovals: (approvals: readonly TApproval[]) => Promise<void>;
  flushEvents?: () => Promise<void>;
  onUsage?: AgentUsageListener;
}

/**
 * Active lessons shown on every request. Twenty one-line titles is ~600 tokens; the operator
 * archives to make room rather than the agent forgetting on its own.
 */
const LESSONS_DIGEST_LIMIT = 20;

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
    compactionModel: options.compactionModel,
    tools: createWritingTools(),
    toolContext,
    systemPrompt: buildSystemPrompt({
      skills: writingSkills,
      autoApprove: options.settings.autoApprove,
      instructions: options.instructions,
    }),
    volatileContext: async () => {
      const [draft, sessionMemories, lessons] = await Promise.all([
        options.draft.get(options.agentSessionId),
        options.memory.listBySession(options.agentSessionId),
        options.memory.listActiveLessons(LESSONS_DIGEST_LIMIT),
      ]);
      return buildTurnContext({
        draft,
        sessionMemories,
        lessons,
        targetFeedId: options.targetFeedId,
        defaultLocale,
        now: new Date(),
      });
    },
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
    onUsage: options.onUsage,
  });
};
