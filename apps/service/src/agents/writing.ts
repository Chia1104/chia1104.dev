import { PgDraftStore } from "@chia/agent-writing/draft/pg-draft-store";
import {
  assertWritingModel,
  listWritingModels,
  WRITING_AGENT_KIND,
  WRITING_SESSION_DEFAULTS,
} from "@chia/agent-writing/models";
import { writingPolicy } from "@chia/agent-writing/policy";
import { writingSkills } from "@chia/agent-writing/prompts/skills";
import { writingPromptTemplates } from "@chia/agent-writing/prompts/templates";
import {
  compactWritingSession,
  navigateWritingSession,
  runWritingTurn,
} from "@chia/agent-writing/runtime";
import { createWritingTools } from "@chia/agent-writing/tools/tool-set";
import {
  createWritingAgentSession,
  getWritingAgentSession,
} from "@chia/db/repos/agent";
import type { WritingAgentSession } from "@chia/db/schema";
import { CallerTier } from "@chia/service-kit/policies/caller.policy";
import { getAdminId } from "@chia/utils/config";

import { createAgentContentPort } from "../services/agent-content.port";
import { createAgentWebPort } from "../services/agent-web.port";

import type { AgentDraftPayload, AgentKindDefinition } from "./kind";

/**
 * The **writing** agent: the dashboard's blog authoring assistant.
 *
 * The domain — tools, prompts, policy, model allowlist, draft staging — is `@chia/agent-writing`.
 * This binds it to the host: the author-visibility content port, the Firecrawl web port and the
 * Postgres draft store, plus the `agent.writing_session` row that pins a session to a target post.
 */

export const writingAgentKind: AgentKindDefinition<WritingAgentSession> = {
  kind: WRITING_AGENT_KIND,

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
        const content = createAgentContentPort({ db, adminId: caller.adminId });
        const post = await content.getPost({ feedId: input.targetFeedId });
        if (post) await new PgDraftStore(db).seedFromPost(sessionId, post);
      }
    },

    async load(db, sessionId) {
      return (await getWritingAgentSession(db, sessionId)) ?? null;
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

  runTurn(context) {
    /**
     * The writing agent acts as the configured author. The kind's `minTier` is `Root`, which pins
     * session ownership to that same id, so this states whose posts the port touches rather than
     * performing a second authorization check.
     */
    const content = createAgentContentPort({
      db: context.db,
      adminId: getAdminId(),
    });

    return runWritingTurn({
      session: context.session,
      models: context.models,
      settings: context.settings,
      agentSessionId: context.row.id,
      targetFeedId: context.state.targetFeedId ?? undefined,
      content,
      web: createAgentWebPort(),
      draft: new PgDraftStore(context.db),
      onEvent: context.onEvent,
      approvedToolCallIds: context.approvedToolCallIds,
      preAuthorizedToolNames: context.preAuthorizedToolNames,
      signal: context.signal,
      message: context.message,
      toApproval: context.toApproval,
      persistApprovals: context.persistApprovals,
      flushEvents: context.flushEvents,
    });
  },

  maintenance(options) {
    return {
      compact: (customInstructions) =>
        compactWritingSession(options, customInstructions),
      navigate: (entryId, navigationOptions) =>
        navigateWritingSession(options, entryId, navigationOptions),
    };
  },
};
