import type { Api, Model, Models } from "@earendil-works/pi-ai";
import * as z from "zod";

import { createAgentModels, NO_ACCESS } from "@chia/agent-runtime/models";
import type { AgentModelAccess } from "@chia/agent-runtime/models";
import type { ApprovalRequest } from "@chia/agent-runtime/pi/tool-gate";
import { runPiTurn } from "@chia/agent-runtime/pi/turn";
import type { RenderedAttachments } from "@chia/agent-runtime/pi/turn";
import type { SessionTree } from "@chia/agent-runtime/session/tree";
import type {
  AgentSessionSettings,
  AgentTurnExecution,
  AgentTurnMessage,
  AgentUsageListener,
  ToolCallRequest,
} from "@chia/agent-runtime/types";
import type {
  AgentAttachment,
  AgentWireEvent,
} from "@chia/agent-runtime/wire/schema";
import { Locale } from "@chia/db/types";
import { stableStringify } from "@chia/utils/json";
import type { JsonValue } from "@chia/utils/json";

import { DraftNotFoundError, draftTitle } from "./draft/operations.ts";
import { resolveWritingModel } from "./models.ts";
import { writingPolicy, writingTurnBudget } from "./policy.ts";
import type { ContentPort, DraftStore, MemoryPort, WebPort } from "./ports.ts";
import { writingSkills } from "./prompts/skills.ts";
import { buildSystemPrompt, buildTurnContext } from "./prompts/system.ts";
import type { TurnContextDraft } from "./prompts/system.ts";
import { writingPromptTemplates } from "./prompts/templates.ts";
import { TOOL_NAMES } from "./tools/registry.ts";
import { createWritingTools } from "./tools/tool-set.ts";
import type { SessionDraftRef, WritingToolContext } from "./types.ts";

export interface RunWritingTurnOptions<TApproval> {
  session: SessionTree;
  settings: AgentSessionSettings;
  agentSessionId: string;
  agentRunId?: string;
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
  approvedApprovalKeys?: ReadonlySet<string>;
  consumeApproval?: (key: string) => Promise<void>;
  signal?: AbortSignal;
  models?: Models;
  /** Keys the caller holds; must match how `models` was built. */
  access?: AgentModelAccess;
  compactionModel?: Model<Api>;
  defaultLocale?: Locale;
  toApproval: (request: ApprovalRequest) => TApproval;
  persistApproval: (approval: TApproval) => Promise<void>;
  flushEvents?: () => Promise<void>;
  onUsage?: AgentUsageListener;
}

/**
 * What the operator approves when they approve a commit-tier call. `commit_draft` is pinned to
 * the draft revision they looked at, so a draft edited after the decision, by them or by the
 * model on its way back, is gated again instead of committed unseen. A discarded draft still
 * keys, and the call itself reports it missing.
 *
 * The revision the key was read from is also the revision that call may commit, so it is
 * recorded in `approvedDraftRevisions` under the call's id for `commit_draft` to apply.
 */
export const writingApprovalKeyOf =
  (store: DraftStore, approvedDraftRevisions: Map<string, number>) =>
  async (request: ToolCallRequest): Promise<string> => {
    const args = commitArgsSchema.safeParse(request.input).data ?? {};
    switch (request.toolName) {
      case TOOL_NAMES.commitDraft: {
        const draftId = args.draftId;
        try {
          const draft = await store.get(draftId ?? Number.NaN);
          approvedDraftRevisions.set(request.toolCallId, draft.revision);
          return `${request.toolName}:${draftId}@${draft.revision}`;
        } catch (error) {
          if (error instanceof DraftNotFoundError) {
            return `${request.toolName}:${draftId}@missing`;
          }
          throw error;
        }
      }
      case TOOL_NAMES.setPublished:
        return `${request.toolName}:${args.feedId}:${args.published}`;
      default:
        return `${request.toolName}:${stableStringify(
          // SAFETY: tool arguments passed their registered TypeBox schema, so they are plain JSON.
          (request.input ?? null) as JsonValue
        )}`;
    }
  };

/** The arguments the approval key reads; `confirmation` is prose for the operator and does not identify the call. */
const commitArgsSchema = z.object({
  draftId: z.number().int().optional(),
  feedId: z.number().int().optional(),
  published: z.boolean().optional(),
});

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

/** Quoted as a fenced block so the model can copy it byte-exact into `oldString`. */
const quoted = (text: string): string => `"""\n${text}\n"""`;

/** One line, or one block, per attachment; `label` is what the client shows for it. */
const renderAttachment = async (
  store: DraftStore,
  attachment: AgentAttachment
): Promise<{ text: string; label: string }> => {
  if (attachment.type === "feed") {
    return {
      text: `- A published post this agent cannot read as an attachment; ignore it.`,
      label: `Post #${attachment.id}`,
    };
  }
  if (attachment.type === "selection") {
    const { source, text } = attachment;
    if (source.type !== "draft") {
      return {
        text: `- A selection from a "${source.type}" this agent cannot read; ignore it.`,
        label: "Selection",
      };
    }
    const range =
      source.startLine === source.endLine
        ? `line ${source.startLine}`
        : `lines ${source.startLine}–${source.endLine}`;
    const label = `Draft #${source.id} · ${source.locale} · ${range}`;
    try {
      const draft = await store.get(source.id);
      const title = draftTitle(draft);
      return {
        text:
          `- Selected in draft #${draft.id}${title ? ` "${title}"` : ""}, locale ${source.locale}, ${range} ` +
          `(revision ${draft.revision}; the line numbers are the editor's at the time and may have ` +
          `shifted, so locate the passage by its text, read the draft before editing and use this ` +
          `text as \`oldString\`):\n${quoted(text)}`,
        label,
      };
    } catch (error) {
      if (!(error instanceof DraftNotFoundError)) throw error;
      return {
        text: `- Selected in draft #${source.id}, which no longer exists; the operator discarded it:\n${quoted(text)}`,
        label: `${label} (discarded)`,
      };
    }
  }
  try {
    const draft = await store.get(attachment.id);
    const title = draftTitle(draft);
    const locales = Object.keys(draft.translations);
    return {
      text:
        `- Draft #${draft.id}${title ? ` "${title}"` : ""}: ` +
        `${draft.feedId === null ? "a new post" : `feed ${draft.feedId}`}, revision ${draft.revision}, ` +
        `locales ${locales.length > 0 ? locales.join(", ") : "none"}. Use draftId ${draft.id}.`,
      label: title ?? `Draft #${draft.id}`,
    };
  } catch (error) {
    if (!(error instanceof DraftNotFoundError)) throw error;
    return {
      text: `- Draft #${attachment.id} no longer exists; the operator discarded it.`,
      label: `Draft #${attachment.id} (discarded)`,
    };
  }
};

/** The block the model reads ahead of the operator's words when they attached anything. */
const renderAttachments = async (
  store: DraftStore,
  attachments: readonly AgentAttachment[]
): Promise<RenderedAttachments> => {
  const rendered = await Promise.all(
    attachments.map((attachment) => renderAttachment(store, attachment))
  );
  return {
    text: `The operator attached:\n${rendered.map((entry) => entry.text).join("\n")}`,
    attachments: attachments.map((attachment, index) => ({
      ...attachment,
      label: rendered[index]?.label,
    })),
  };
};

export const runWritingTurn = <TApproval>(
  options: RunWritingTurnOptions<TApproval>
): Promise<AgentTurnExecution<TApproval>> => {
  const defaultLocale = options.defaultLocale ?? Locale.zhTW;
  const models = options.models ?? createAgentModels();
  const approvedDraftRevisions = new Map<string, number>();
  const toolContext: WritingToolContext = {
    agentSessionId: options.agentSessionId,
    content: options.content,
    web: options.web,
    draft: options.draft,
    memory: options.memory,
    approvedDraftRevisions,
  };

  return runPiTurn({
    agentSessionId: options.agentSessionId,
    agentRunId: options.agentRunId,
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
      renderAttachments(options.draft, attachments),
    signal: options.signal,
    promptTemplates: writingPromptTemplates,
    policy: writingPolicy,
    budget: writingTurnBudget,
    approvalKeyOf: writingApprovalKeyOf(options.draft, approvedDraftRevisions),
    approvedApprovalKeys: options.approvedApprovalKeys,
    consumeApproval: options.consumeApproval,
    message: options.message,
    onEvent: options.onEvent,
    toApproval: options.toApproval,
    persistApproval: options.persistApproval,
    flushEvents: options.flushEvents,
    onUsage: options.onUsage,
  });
};
