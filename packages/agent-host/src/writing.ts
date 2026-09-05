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
import { DRAFT_ATTACHMENT_TYPE } from "@chia/agent-writing/types";
import type { DB } from "@chia/db/client";
import {
  copyWritingSessionDrafts,
  createWritingAgentSession,
  getWritingAgentSession,
  touchWritingSessionDrafts,
} from "@chia/db/repos/agent";
import type { WritingAgentSessionState } from "@chia/db/repos/agent";
import { getFeedDraft } from "@chia/db/repos/drafts";
import type { FeedDraftRecord } from "@chia/db/repos/drafts";
import { AppError } from "@chia/service-kit/errors";
import { CallerTier } from "@chia/service-kit/policies/caller.policy";

import type { AgentDraftPayload, AgentKindDefinition } from "./kind";
import { AGENT_TASK_IDS, resolveAgentTask } from "./tasks";

/**
 * Binds `@chia/agent-writing` to the host: author-visibility content port, Firecrawl web port,
 * the shared `feed_draft` store, memory port, and the `agent.writing_session` rows.
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
  /** Get-or-create a shared draft: a feed's working draft, or a fresh empty one. */
  openDraft(options: {
    db: DB;
    adminId: string;
    sessionId: string;
    feedId?: number;
  }): Promise<FeedDraftRecord>;
  /** The author's drafts with unapplied work, newest first. */
  listDrafts(options: { db: DB; adminId: string }): Promise<FeedDraftRecord[]>;
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
      async create(_caller, db, sessionId) {
        await createWritingAgentSession(db, { sessionId });
      },

      load(db, sessionId) {
        return getWritingAgentSession(db, sessionId);
      },

      /** The drafts are shared, not copied: the fork keeps working on the same rows. */
      async fork(db, sourceSessionId, sessionId) {
        const source = await getWritingAgentSession(db, sourceSessionId);
        if (!source) {
          throw new Error(`Writing session ${sourceSessionId} has no state`);
        }
        await createWritingAgentSession(db, { sessionId });
        await copyWritingSessionDrafts(db, sourceSessionId, sessionId);
      },

      async detail(db, _sessionId, state) {
        // Ownership was checked when the session row was loaded; the drafts are bound to it.
        const drafts = await Promise.all(
          state.drafts.map((entry) => getFeedDraft(db, entry.draftId))
        );
        return {
          drafts: drafts
            .filter((draft) => draft !== null)
            .map((draft) => toDraftPayload(draft)),
        };
      },

      async attach(caller, db, sessionId, attachments) {
        for (const attachment of attachments) {
          if (attachment.type !== DRAFT_ATTACHMENT_TYPE) {
            throw new AppError("BAD_REQUEST", {
              message: `The writing agent takes no "${attachment.type}" attachments.`,
            });
          }
          const draft = await getFeedDraft(db, attachment.id);
          if (!draft || draft.userId !== caller.userId) {
            throw new AppError("NOT_FOUND", {
              message: `Unknown draft: ${attachment.id}`,
            });
          }
        }
        await touchWritingSessionDrafts(
          db,
          sessionId,
          attachments.map((attachment) => ({ draftId: attachment.id }))
        );
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
        const draft = new PgDraftStore(context.db, {
          sessionId: context.row.id,
          open: ({ feedId }) =>
            host.openDraft({
              db: context.db,
              adminId,
              sessionId: context.row.id,
              feedId,
            }),
          list: () => host.listDrafts({ db: context.db, adminId }),
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
          sessionDrafts: context.state.drafts,
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

        // Every draft the turn read or wrote is the session's now, seen up to that revision, so
        // operator edits the model has already been shown are not reported again next turn.
        await touchWritingSessionDrafts(
          context.db,
          context.row.id,
          [...draft.observedRevisions].map(([draftId, lastSeenRevision]) => ({
            draftId,
            lastSeenRevision,
          }))
        );

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
