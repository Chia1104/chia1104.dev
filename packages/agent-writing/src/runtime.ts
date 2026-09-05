import type { Api, Model, Models } from "@earendil-works/pi-ai";

import { createAgentModels, NO_ACCESS } from "@chia/agent-runtime/models";
import type { AgentModelAccess } from "@chia/agent-runtime/models";
import type { ApprovalRequest } from "@chia/agent-runtime/pi/tool-gate";
import { runPiTurn } from "@chia/agent-runtime/pi/turn";
import type { RenderedAttachments } from "@chia/agent-runtime/pi/turn";
import type { SessionTree } from "@chia/agent-runtime/session/tree";
import type {
  AgentAttachment,
  AgentSessionSettings,
  AgentTurnExecution,
  AgentTurnMessage,
  AgentUsageListener,
} from "@chia/agent-runtime/types";
import type { AgentWireEvent } from "@chia/agent-runtime/wire/schema";
import { Locale } from "@chia/db/types";

import { DraftNotFoundError, draftTitle } from "./draft/operations.ts";
import { resolveWritingModel } from "./models.ts";
import { writingPolicy, writingTurnBudget } from "./policy.ts";
import type { ContentPort, DraftStore, MemoryPort, WebPort } from "./ports.ts";
import { writingSkills } from "./prompts/skills.ts";
import { buildSystemPrompt, buildTurnContext } from "./prompts/system.ts";
import type { TurnContextDraft } from "./prompts/system.ts";
import { writingPromptTemplates } from "./prompts/templates.ts";
import { createWritingTools } from "./tools/tool-set.ts";
import { DRAFT_ATTACHMENT_TYPE } from "./types.ts";
import type { SessionDraftRef, WritingToolContext } from "./types.ts";

export interface RunWritingTurnOptions<TApproval> {
  session: SessionTree;
  settings: AgentSessionSettings;
  agentSessionId: string;
  content: ContentPort;
  web: WebPort;
  draft: DraftStore;
  /**
   * Drafts this session has worked on, most recently touched first, with the revision the
   * previous turn saw; operator edits above it are reported.
   */
  sessionDrafts?: readonly SessionDraftRef[];
  memory: MemoryPort;
  instructions?: string;
  message: AgentTurnMessage;
  onEvent: (event: AgentWireEvent) => void;
  approvedToolCallIds?: ReadonlySet<string>;
  preAuthorizedToolNames?: ReadonlySet<string>;
  signal?: AbortSignal;
  models?: Models;
  /** Keys the caller holds; must match how `models` was built. */
  access?: AgentModelAccess;
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

/** Drafts described in full on every request; older ones stay reachable through `list_drafts`. */
const CONTEXT_DRAFT_LIMIT = 5;

/** The drafts the session works on, as the volatile context shows them; a discarded one is dropped. */
const describeSessionDrafts = async (
  store: DraftStore,
  refs: readonly SessionDraftRef[]
): Promise<TurnContextDraft[]> => {
  const entries = await Promise.all(
    refs.slice(0, CONTEXT_DRAFT_LIMIT).map(async (ref) => {
      try {
        const draft = await store.get(ref.draftId);
        const operatorChanges = await store.operatorChangesSince(
          ref.draftId,
          ref.lastSeenRevision
        );
        return { draft, operatorChanges };
      } catch (error) {
        if (error instanceof DraftNotFoundError) return null;
        throw error;
      }
    })
  );
  return entries.filter((entry) => entry !== null);
};

/** The block the model reads ahead of the operator's words when they attached drafts. */
const renderDraftAttachments = async (
  store: DraftStore,
  attachments: readonly AgentAttachment[]
): Promise<RenderedAttachments> => {
  const lines: string[] = [];
  const labelled: AgentAttachment[] = [];
  for (const attachment of attachments) {
    if (attachment.type !== DRAFT_ATTACHMENT_TYPE) {
      lines.push(
        `- An attachment of type "${attachment.type}" (#${attachment.id}) this agent cannot read; ignore it.`
      );
      labelled.push(attachment);
      continue;
    }
    try {
      const draft = await store.get(attachment.id);
      const title = draftTitle(draft);
      const locales = Object.keys(draft.translations);
      lines.push(
        `- Draft #${draft.id}${title ? ` "${title}"` : ""}: ` +
          `${draft.feedId === null ? "a new post" : `feed ${draft.feedId}`}, revision ${draft.revision}, ` +
          `locales ${locales.length > 0 ? locales.join(", ") : "none"}. Use draftId ${draft.id}.`
      );
      labelled.push({ ...attachment, label: title ?? `Draft #${draft.id}` });
    } catch (error) {
      if (!(error instanceof DraftNotFoundError)) throw error;
      lines.push(
        `- Draft #${attachment.id} no longer exists; the operator discarded it.`
      );
      labelled.push({
        ...attachment,
        label: `Draft #${attachment.id} (discarded)`,
      });
    }
  }
  return {
    text: `The operator attached:\n${lines.join("\n")}`,
    attachments: labelled,
  };
};

export const runWritingTurn = <TApproval>(
  options: RunWritingTurnOptions<TApproval>
): Promise<AgentTurnExecution<TApproval>> => {
  const defaultLocale = options.defaultLocale ?? Locale.zhTW;
  const models = options.models ?? createAgentModels();
  const toolContext: WritingToolContext = {
    agentSessionId: options.agentSessionId,
    content: options.content,
    web: options.web,
    draft: options.draft,
    memory: options.memory,
  };

  return runPiTurn({
    agentSessionId: options.agentSessionId,
    session: options.session,
    settings: options.settings,
    model: resolveWritingModel(
      options.settings,
      models,
      options.access ?? NO_ACCESS
    ),
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
      const [drafts, sessionMemories, lessons] = await Promise.all([
        describeSessionDrafts(options.draft, options.sessionDrafts ?? []),
        options.memory.listBySession(options.agentSessionId),
        options.memory.listActiveLessons(LESSONS_DIGEST_LIMIT),
      ]);
      return buildTurnContext({
        drafts,
        sessionMemories,
        lessons,
        defaultLocale,
        now: new Date(),
      });
    },
    renderAttachments: (attachments) =>
      renderDraftAttachments(options.draft, attachments),
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
