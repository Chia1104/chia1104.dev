import {
  WRITING_CONFIG_DEFAULTS,
  writingConfigSchema,
} from "@chia/agent-writing/config";
import type { WritingConfig } from "@chia/agent-writing/config";
import { PgDraftStore } from "@chia/agent-writing/draft/pg-draft-store";
import {
  assertWritingModel,
  listWritingModels,
  resolveWritingModel,
  WRITING_AGENT_KIND,
  WRITING_SESSION_DEFAULTS,
} from "@chia/agent-writing/models";
import { writingPolicy } from "@chia/agent-writing/policy";
import type {
  ContentPort,
  MemoryPort,
  WebPort,
} from "@chia/agent-writing/ports";
import { writingSkills } from "@chia/agent-writing/prompts/skills";
import { writingPromptTemplates } from "@chia/agent-writing/prompts/templates";
import { runWritingTurn } from "@chia/agent-writing/runtime";
import { createWritingTools } from "@chia/agent-writing/tools/tool-set";
import type { DB } from "@chia/db/client";
import {
  createWritingAgentSession,
  getWritingAgentSession,
  updateWritingAgentSession,
} from "@chia/db/repos/agent";
import type { WritingAgentSessionState } from "@chia/db/repos/agent";
import { getFeedDraft } from "@chia/db/repos/drafts";
import type { FeedDraftRecord } from "@chia/db/repos/drafts";
import { CallerTier } from "@chia/service-kit/policies/caller.policy";

import type { AgentDraftPayload, AgentKindDefinition } from "./kind";
import { AGENT_TASK_IDS, resolveAgentTask } from "./tasks";

/**
 * Binds `@chia/agent-writing` to the host: author-visibility content port, Firecrawl web port,
 * the shared `feed_draft` store, memory port, and the `agent.writing_session` row.
 */

type WritingAgentKind = AgentKindDefinition<
  WritingAgentSessionState,
  WritingConfig
>;

interface WritingExecutionHost {
  adminId(): string;
  createContentPort(options: {
    db: DB;
    adminId: string;
    onCommitted: () => void;
  }): ContentPort;
  createMemoryPort(options: { db: DB; sessionId: string }): MemoryPort;
  createWebPort(): WebPort;
  startMemoryConsolidation(sessionId: string): Promise<string>;
}

export interface CreateWritingAgentKindOptions {
  /**
   * Get-or-create the shared draft a session edits: a feed's working draft, an existing
   * draft by id, or a fresh empty one.
   */
  openDraft(options: {
    db: DB;
    adminId: string;
    sessionId: string;
    feedId?: number;
    draftId?: number;
  }): Promise<FeedDraftRecord>;
  execution?: WritingExecutionHost;
}

const toDraftPayload = (draft: FeedDraftRecord): AgentDraftPayload => ({
  id: draft.id,
  feedId: draft.feedId,
  revision: draft.revision,
  appliedRevision: draft.appliedRevision,
  slug: draft.slug,
  type: draft.type,
  defaultLocale: draft.defaultLocale,
  mainImage: draft.mainImage,
  translations: draft.translations,
  createdAt: draft.createdAt.toISOString(),
  updatedAt: draft.updatedAt.toISOString(),
});

export const createWritingAgentKind = (
  host: CreateWritingAgentKindOptions
): WritingAgentKind => {
  // Bound once so the closures below see the narrowed type, not the optional property.
  const execution = host.execution;
  return {
    kind: WRITING_AGENT_KIND,
    label: "Writing",
    description:
      "Researches, drafts and revises blog posts with the author inside the dashboard.",

    /**
     * The configured admin only. These tools write to and publish the blog; `Root` also
     * makes `caller.adminId` and `caller.userId` the same person, which is what lets the
     * content port act as the author.
     */
    minTier: CallerTier.Root,
    defaults: WRITING_SESSION_DEFAULTS,
    policy: writingPolicy,

    models: {
      assert: assertWritingModel,
      list: listWritingModels,
      resolve: resolveWritingModel,
    },

    config: {
      schema: writingConfigSchema,
      defaults: WRITING_CONFIG_DEFAULTS,
    },

    capabilities() {
      return {
        tools: createWritingTools().map((tool) => ({
          name: tool.name,
          label: tool.label,
          tier: writingPolicy.tierOf(tool.name),
          description: tool.description,
        })),
        commands: writingPromptTemplates.map((template) => ({
          name: template.name,
          description: template.description ?? template.name,
          argumentHint: template.argumentHint,
        })),
        skills: writingSkills
          .filter((skill) => !skill.disableModelInvocation)
          .map((skill) => ({
            name: skill.name,
            description: skill.description,
          })),
      };
    },

    state: {
      async create(caller, db, sessionId, input) {
        const draft = await host.openDraft({
          db,
          adminId: caller.adminId,
          sessionId,
          feedId: input.targetFeedId,
          draftId: input.draftId,
        });
        await createWritingAgentSession(db, { sessionId, draftId: draft.id });
      },

      async load(db, sessionId) {
        return (await getWritingAgentSession(db, sessionId)) ?? null;
      },

      /** The draft is shared, not copied: both sessions keep editing the same working copy. */
      async fork(db, sourceSessionId, sessionId) {
        const source = await getWritingAgentSession(db, sourceSessionId);
        if (!source) {
          throw new Error(`Writing session ${sourceSessionId} has no state`);
        }
        await createWritingAgentSession(db, {
          sessionId,
          draftId: source.draftId,
        });
        await updateWritingAgentSession(db, sessionId, {
          lastSeenRevision: source.lastSeenRevision,
        });
      },

      summary(state) {
        return {
          draftId: state.draftId,
          targetFeedId: state.draft?.feedId ?? null,
        };
      },

      async detail(db, _sessionId, state) {
        if (state.draftId === null) return {};
        // Ownership was checked when the session row was loaded; the draft is bound to it.
        const draft = await getFeedDraft(db, state.draftId);
        return draft ? { draft: toDraftPayload(draft) } : {};
      },
    },

    ...(execution && {
      async runTurn(context) {
        let committed = false;
        const adminId = execution.adminId();
        const content = execution.createContentPort({
          db: context.db,
          adminId,
          onCommitted: () => {
            committed = true;
          },
        });

        // A discarded draft leaves the session without one; the turn opens a fresh draft.
        let draftId = context.state.draftId;
        if (draftId === null) {
          const draft = await host.openDraft({
            db: context.db,
            adminId,
            sessionId: context.row.id,
          });
          draftId = draft.id;
          await updateWritingAgentSession(context.db, context.row.id, {
            draftId,
            lastSeenRevision: 0,
          });
        }
        const draft = new PgDraftStore(context.db, {
          draftId,
          sessionId: context.row.id,
        });

        // The compaction task may be pinned to a house model; the session's own is only resolved
        // when the task follows it.
        const compaction = await resolveAgentTask(
          context.db,
          AGENT_TASK_IDS.sessionCompaction,
          {
            session: () => ({
              model: resolveWritingModel(
                context.settings,
                context.models,
                context.access
              ),
              models: context.models,
            }),
          }
        );

        const turn = await runWritingTurn({
          session: context.session,
          models: context.models,
          access: context.access,
          settings: context.settings,
          compactionModel: compaction.model,
          instructions: context.config.instructions,
          agentSessionId: context.row.id,
          content,
          web: execution.createWebPort(),
          draft,
          lastSeenRevision: context.state.lastSeenRevision,
          memory: execution.createMemoryPort({
            db: context.db,
            sessionId: context.row.id,
          }),
          onEvent: context.onEvent,
          approvedToolCallIds: context.approvedToolCallIds,
          preAuthorizedToolNames: context.preAuthorizedToolNames,
          signal: context.signal,
          message: context.message,
          toApproval: context.toApproval,
          persistApprovals: context.persistApprovals,
          flushEvents: context.flushEvents,
          onUsage: context.onUsage,
        });

        // Operator edits the model has already been shown are not reported again next turn.
        if (draft.lastObservedRevision > context.state.lastSeenRevision) {
          await updateWritingAgentSession(context.db, context.row.id, {
            lastSeenRevision: draft.lastObservedRevision,
          });
        }

        // After the turn ends: `runPiTurn` appends every entry before it resolves.
        if (turn.status === "done" && committed) {
          try {
            await execution.startMemoryConsolidation(context.row.id);
          } catch (cause) {
            console.error("Could not start memory consolidation", {
              sessionId: context.row.id,
              error: String(cause),
            });
          }
        }

        return turn;
      },
    }),
  };
};
