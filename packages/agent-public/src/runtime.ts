import type { Api, Model, Models } from "@earendil-works/pi-ai";

import type { ContentReadPort } from "@chia/agent-content/types";
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

import { resolvePublicModel } from "./models.ts";
import { publicPolicy, publicTurnBudget } from "./policy.ts";
import { buildSystemPrompt, buildTurnContext } from "./prompts/system.ts";
import { createPublicTools } from "./tools/tool-set.ts";
import type { PublicToolContext } from "./types.ts";

export interface RunPublicTurnOptions<TApproval> {
  session: SessionTree;
  settings: AgentSessionSettings;
  agentSessionId: string;
  /** Built by the host with `public` visibility; the tools cannot widen it. */
  content: ContentReadPort;
  instructions?: string;
  message: AgentTurnMessage;
  onEvent: (event: AgentWireEvent) => void;
  approvedToolCallIds?: ReadonlySet<string>;
  preAuthorizedToolNames?: ReadonlySet<string>;
  signal?: AbortSignal;
  models?: Models;
  compactionModel?: Model<Api>;
  defaultLocale?: Locale;
  toApproval: (request: ApprovalRequest) => TApproval;
  persistApprovals: (approvals: readonly TApproval[]) => Promise<void>;
  flushEvents?: () => Promise<void>;
  onUsage?: AgentUsageListener;
}

export const runPublicTurn = <TApproval>(
  options: RunPublicTurnOptions<TApproval>
): Promise<AgentTurnExecution<TApproval>> => {
  const defaultLocale = options.defaultLocale ?? Locale.zhTW;
  const models = options.models ?? createAgentModels();
  const toolContext: PublicToolContext = { content: options.content };

  return runPiTurn({
    agentSessionId: options.agentSessionId,
    session: options.session,
    settings: options.settings,
    model: resolvePublicModel(options.settings, models),
    models,
    compactionModel: options.compactionModel,
    tools: createPublicTools(),
    toolContext,
    systemPrompt: buildSystemPrompt({ instructions: options.instructions }),
    volatileContext: () => buildTurnContext({ defaultLocale, now: new Date() }),
    signal: options.signal,
    policy: publicPolicy,
    budget: publicTurnBudget,
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
