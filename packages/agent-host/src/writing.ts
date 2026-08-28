import type { PostSnapshot } from "@chia/agent-content/types";
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
import {
  copyWritingAgentDrafts,
  createWritingAgentSession,
  getWritingAgentSession,
} from "@chia/db/repos/agent";
import type { WritingAgentSession } from "@chia/db/schema";
import { CallerTier } from "@chia/service-kit/policies/caller.policy";

import type { AgentDraftPayload, AgentKindDefinition } from "./kind";
import { AGENT_TASK_IDS, resolveAgentTask } from "./tasks";

/**
 * The **writing** agent: the dashboard's blog authoring assistant.
 *
 * The domain — tools, prompts, policy, model allowlist, draft staging — is `@chia/agent-writing`.
 * This binds it to the host: the author-visibility content port, the Firecrawl web port, the
 * Postgres draft store and the memory port, plus the `agent.writing_session` row that pins a
 * session to a target post.
 */

type WritingAgentKind = AgentKindDefinition<WritingAgentSession, WritingConfig>;

interface WritingExecutionHost {
  adminId(): string;
  createContentPort(options: {
    db: Parameters<WritingAgentKind["state"]["load"]>[0];
    adminId: string;
    onCommitted: () => void;
  }): ContentPort;
  createMemoryPort(options: {
    db: Parameters<WritingAgentKind["state"]["load"]>[0];
    sessionId: string;
  }): MemoryPort;
  createWebPort(): WebPort;
  /** Resolves to the consolidation run id. */
  startMemoryConsolidation(sessionId: string): Promise<string>;
}

export interface CreateWritingAgentKindOptions {
  getPostForSeed(options: {
    db: Parameters<WritingAgentKind["state"]["load"]>[0];
    adminId: string;
    feedId: number;
  }): Promise<PostSnapshot | null>;
  execution?: WritingExecutionHost;
}

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
     * The configured admin only. These tools write to and publish the blog, so a logged-in visitor
     * must not reach them; `Root` also makes `caller.adminId` and `caller.userId` the same person,
     * which is what lets the content port act as the author.
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
        await createWritingAgentSession(db, {
          sessionId,
          targetFeedId: input.targetFeedId,
        });

        // Opening a session against an existing post seeds the buffer, so the agent edits the real
        // content instead of guessing at it.
        if (input.targetFeedId !== undefined) {
          const post = await host.getPostForSeed({
            db,
            adminId: caller.adminId,
            feedId: input.targetFeedId,
          });
          if (post) await new PgDraftStore(db).seedFromPost(sessionId, post);
        }
      },

      async load(db, sessionId) {
        return (await getWritingAgentSession(db, sessionId)) ?? null;
      },

      async fork(db, sourceSessionId, sessionId) {
        const source = await getWritingAgentSession(db, sourceSessionId);
        if (!source) {
          throw new Error(`Writing session ${sourceSessionId} has no state`);
        }
        await createWritingAgentSession(db, {
          sessionId,
          targetFeedId: source.targetFeedId,
          feedMeta: source.feedMeta,
        });
        await copyWritingAgentDrafts(db, sourceSessionId, sessionId);
      },

      summary(state) {
        return { targetFeedId: state.targetFeedId };
      },

      async detail(db, sessionId) {
        // The draft store's `FeedDraft` is the contract's `AgentDraftPayload` by construction.
        const draft =
          /* SAFETY: The producer contract guarantees this value satisfies AgentDraftPayload. */ (await new PgDraftStore(
            db
          ).get(sessionId)) as AgentDraftPayload;
        return { draft };
      },
    },

    ...(execution && {
      async runTurn(context) {
        /**
         * The writing agent acts as the configured author. The kind's `minTier` is `Root`, which pins
         * session ownership to that same id, so this states whose posts the port touches rather than
         * performing a second authorization check.
         */
        let committed = false;
        const content = execution.createContentPort({
          db: context.db,
          adminId: execution.adminId(),
          onCommitted: () => {
            committed = true;
          },
        });

        // The compaction task may be pinned to a house model; the session's own is only resolved
        // when the task follows it.
        const compaction = await resolveAgentTask(
          context.db,
          AGENT_TASK_IDS.sessionCompaction,
          {
            session: () => ({
              model: resolveWritingModel(context.settings, context.models),
              models: context.models,
            }),
          }
        );

        const turn = await runWritingTurn({
          session: context.session,
          models: context.models,
          settings: context.settings,
          compactionModel: compaction.model,
          instructions: context.config.instructions,
          agentSessionId: context.row.id,
          targetFeedId: context.state.targetFeedId ?? undefined,
          content,
          web: execution.createWebPort(),
          draft: new PgDraftStore(context.db),
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
        });

        /**
         * A committed post is the natural end of a writing task, and the moment the transcript
         * holds the whole revision history — but only once the turn has ended: `runPiTurn` appends
         * every entry before it resolves, whereas inside `commitDraft` the commit's own result and
         * the closing summary are still to come. Fire-and-forget; the run reports for itself.
         */
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
