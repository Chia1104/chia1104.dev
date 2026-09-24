import type { WebPort } from "@chia/agent-content/types";
import {
  WRITING_CONFIG_DEFAULTS,
  parseGitHubRepos,
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
  GitHubPort,
  MemoryPort,
} from "@chia/agent-writing/ports";
import { writingSkills } from "@chia/agent-writing/prompts/skills";
import { writingPromptTemplates } from "@chia/agent-writing/prompts/templates";
import { prepareWritingTurn } from "@chia/agent-writing/runtime";
import { writingToolSpecs } from "@chia/agent-writing/tools/tool-set";
import { CallerTier } from "@chia/auth/tier";
import type { DB } from "@chia/db/client";
import {
  copyWritingSessionDrafts,
  createWritingAgentSession,
  getWritingAgentSession,
  getWritingSessionConsolidation,
  touchWritingSessionDrafts,
  updateWritingSessionConsolidation,
} from "@chia/db/repos/agent";
import type { WritingAgentSessionState } from "@chia/db/repos/agent";
import { getFeedDraft, getFeedDrafts } from "@chia/db/repos/drafts";
import type { FeedDraftListItem, FeedDraftRecord } from "@chia/db/repos/drafts";
import {
  getFeedReport,
  getFeedReportRecord,
} from "@chia/db/repos/feed-reports";
import { reportError } from "@chia/observability/report";
import { AppError, AppErrorCode } from "@chia/service-kit/errors";

import { toolCapabilities } from "./kind";
import type {
  AgentDraftPayload,
  AgentKindDefinition,
  AgentKindExecutor,
} from "./kind";

/**
 * Binds `@chia/agent-writing` to the host: author-visibility content port, Firecrawl web port,
 * the GitHub port scoped to the configured repositories, the shared `feed_draft` store, memory
 * port, and the `agent.writing_session` rows.
 */

type WritingAgentKind = AgentKindDefinition<
  WritingAgentSessionState,
  WritingConfig
>;

export interface WritingExecutionHost {
  /** Get-or-create a shared draft: a feed's working draft, or a fresh empty one. */
  openDraft(options: {
    db: DB;
    adminId: string;
    sessionId: string;
    feedId?: number;
  }): Promise<FeedDraftRecord>;
  /** The author's drafts with unapplied work, newest first. */
  listDrafts(options: {
    db: DB;
    adminId: string;
  }): Promise<FeedDraftListItem[]>;
  adminId(): string;
  createContentPort(options: {
    db: DB;
    adminId: string;
    onCommitted: () => void;
  }): ContentPort;
  createMemoryPort(options: { db: DB; sessionId: string }): MemoryPort;
  createWebPort(): WebPort;
  /** Per turn: the allowlist is the kind config as of this turn, and ref pins must not outlive it. */
  createGitHubPort(options: { allowedRepos: readonly string[] }): GitHubPort;
  /** Starts the lesson extraction run, after `delayMs`; resolves to its run id. */
  startMemoryConsolidation(request: {
    sessionId: string;
    delayMs: number;
  }): Promise<string>;
  cancelWorkflowRun(runId: string): Promise<void>;
}

/**
 * How long a session sits without a turn before its lessons are extracted. A commit extracts
 * at once: the draft is how the operator wanted it, so the corrections that got it there are
 * complete.
 */
const LESSON_EXTRACTION_IDLE_MS = 2 * 60 * 60 * 1000;

const toDraftPayload = (draft: FeedDraftRecord): AgentDraftPayload => ({
  id: draft.id,
  feedId: draft.feedId,
  revision: draft.revision,
  contentHash: draft.contentHash,
  appliedRevisionId: draft.appliedRevisionId,
  appliedHash: draft.appliedHash,
  slug: draft.slug,
  type: draft.type,
  defaultLocale: draft.defaultLocale,
  mainImage: draft.mainImage,
  translations: draft.translations,
  createdAt: draft.createdAt.toISOString(),
  updatedAt: draft.updatedAt.toISOString(),
});

export const createWritingAgentKind = (): WritingAgentKind => ({
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
      tools: toolCapabilities(writingToolSpecs, writingPolicy),
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
      const drafts = await getFeedDrafts(
        db,
        state.drafts.map((entry) => entry.draftId)
      );
      return {
        drafts: drafts.map(toDraftPayload),
      };
    },

    /**
     * A draft by reference, a selection from one, or a reader report. The selection's text is
     * not checked against the row: the editor sends it before its autosave lands, and the model
     * re-reads the draft anyway. A report's status stays the operator's: asking the agent about
     * one must not queue it for resolution by the next draft apply.
     */
    async attach(caller, db, sessionId, attachments) {
      const draftIds = new Set<number>();
      for (const attachment of attachments) {
        if (attachment.type === "report") {
          if (!(await getFeedReport(db, attachment.id))) {
            throw new AppError(AppErrorCode.NotFound, {
              message: `Unknown report: ${attachment.id}`,
            });
          }
          continue;
        }
        if (attachment.type === "feed") {
          throw new AppError(AppErrorCode.BadRequest, {
            message: `The writing agent takes no "feed" attachments.`,
          });
        }
        if (
          attachment.type === "selection" &&
          attachment.source.type !== "draft"
        ) {
          throw new AppError(AppErrorCode.BadRequest, {
            message: `The writing agent takes no "${attachment.source.type}" selections.`,
          });
        }
        const draftId =
          attachment.type === "draft" ? attachment.id : attachment.source.id;
        const draft = await getFeedDraft(db, draftId, caller.userId);
        if (!draft) {
          throw new AppError(AppErrorCode.NotFound, {
            message: `Unknown draft: ${draftId}`,
          });
        }
        draftIds.add(draftId);
      }
      await touchWritingSessionDrafts(
        db,
        sessionId,
        [...draftIds].map((draftId) => ({ draftId }))
      );
    },
  },
});

export const createWritingAgentExecutor = (
  host: WritingExecutionHost
): AgentKindExecutor<WritingAgentSessionState, WritingConfig> => ({
  ...createWritingAgentKind(),

  prepareTurn(context) {
    let committed = false;
    const adminId = host.adminId();
    const content = host.createContentPort({
      db: context.db,
      adminId,
      onCommitted: () => {
        committed = true;
      },
    });
    const draft = new PgDraftStore(context.db, {
      sessionId: context.row.id,
      userId: adminId,
      open: ({ feedId }) =>
        host.openDraft({
          db: context.db,
          adminId,
          sessionId: context.row.id,
          feedId,
        }),
      list: () => host.listDrafts({ db: context.db, adminId }),
    });
    const githubRepos = parseGitHubRepos(context.config.githubRepos);

    const plan = prepareWritingTurn({
      agentSessionId: context.row.id,
      content,
      web: host.createWebPort(),
      github: host.createGitHubPort({ allowedRepos: githubRepos }),
      githubRepos,
      draft,
      sessionDrafts: context.state.drafts,
      memory: host.createMemoryPort({
        db: context.db,
        sessionId: context.row.id,
      }),
      reports: {
        get: async (id) => (await getFeedReportRecord(context.db, id)) ?? null,
      },
      instructions: context.config.instructions,
      autoApprove: context.settings.autoApprove,
    });

    return Promise.resolve({
      ...plan,
      async settle(execution) {
        // Every draft the turn read or wrote is the session's now, seen up to that revision, so
        // operator edits the model has already been shown are not reported again next turn.
        // The turn has already answered; bookkeeping that fails must not fail it.
        try {
          await touchWritingSessionDrafts(
            context.db,
            context.row.id,
            [...draft.observedRevisions].map(([draftId, lastSeenRevision]) => ({
              draftId,
              lastSeenRevision,
            }))
          );
        } catch (cause) {
          reportError(cause, "Could not record the drafts a turn observed", {
            sessionId: context.row.id,
          });
        }

        // One run waits per session; this turn's replaces the one the previous turn scheduled.
        if (execution.status !== "done") return;
        try {
          const current = await getWritingSessionConsolidation(
            context.db,
            context.row.id
          );
          if (current?.consolidationRunId) {
            const runId = current.consolidationRunId;
            await host.cancelWorkflowRun(runId).catch((cause) =>
              reportError(
                cause,
                "Superseded lesson extraction could not be cancelled",
                {
                  sessionId: context.row.id,
                  runId,
                }
              )
            );
          }
          const runId = await host.startMemoryConsolidation({
            sessionId: context.row.id,
            delayMs: committed ? 0 : LESSON_EXTRACTION_IDLE_MS,
          });
          await updateWritingSessionConsolidation(context.db, context.row.id, {
            consolidationRunId: runId,
          });
        } catch (cause) {
          reportError(cause, "Could not schedule lesson extraction", {
            sessionId: context.row.id,
          });
        }
      },
    });
  },
});
