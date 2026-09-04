import type {
  ContentReadPort,
  ProfileReadPort,
} from "@chia/agent-content/types";
import {
  PUBLIC_CONFIG_DEFAULTS,
  publicConfigSchema,
} from "@chia/agent-public/config";
import type { PublicConfig } from "@chia/agent-public/config";
import {
  assertPublicModel,
  listPublicModels,
  PUBLIC_AGENT_KIND,
  PUBLIC_SESSION_DEFAULTS,
  resolvePublicModel,
} from "@chia/agent-public/models";
import { publicPolicy } from "@chia/agent-public/policy";
import { runPublicTurn } from "@chia/agent-public/runtime";
import { createPublicTools } from "@chia/agent-public/tools/tool-set";
import type { DB } from "@chia/db/client";
import { CallerTier } from "@chia/service-kit/policies/caller.policy";

import type { AgentKindDefinition } from "./kind";
import { AGENT_TASK_IDS, resolveAgentTask } from "./tasks";

/**
 * Binds `@chia/agent-public` to the host: a `public`-visibility content port and nothing else.
 * It keeps no row beside `agent.session`: a public session is its transcript.
 */

/** No extension row; the loaded state is an empty object so the session stays visible. */
export type PublicAgentState = Record<string, never>;

type PublicAgentKind = AgentKindDefinition<PublicAgentState, PublicConfig>;

interface PublicExecutionHost {
  /** Must be built with `public` visibility; the kind cannot check that, only rely on it. */
  createContentPort(options: { db: DB }): ContentReadPort;
  /** Published rows only, for the same reason. */
  createProfilePort(options: { db: DB }): ProfileReadPort;
}

export interface CreatePublicAgentKindOptions {
  execution?: PublicExecutionHost;
}

export const createPublicAgentKind = (
  host: CreatePublicAgentKindOptions = {}
): PublicAgentKind => {
  const execution = host.execution;
  return {
    kind: PUBLIC_AGENT_KIND,
    label: "Reader",
    description:
      "Answers visitors' questions about the author and the published posts, on the public site.",

    /**
     * Anyone with a user row. Lower tiers are metered by the shared weekly allowance and the
     * running-turn cap; only `Root` is not.
     */
    minTier: CallerTier.Root,
    defaults: PUBLIC_SESSION_DEFAULTS,
    policy: publicPolicy,

    models: {
      assert: assertPublicModel,
      list: listPublicModels,
      resolve: resolvePublicModel,
    },

    config: {
      schema: publicConfigSchema,
      defaults: PUBLIC_CONFIG_DEFAULTS,
    },

    capabilities() {
      return {
        tools: createPublicTools().map((tool) => ({
          name: tool.name,
          label: tool.label,
          tier: publicPolicy.tierOf(tool.name),
          description: tool.description,
        })),
        commands: [],
        skills: [],
      };
    },

    state: {
      create: () => Promise.resolve(),
      load: () => Promise.resolve({}),
      fork: () => Promise.resolve(),
      summary: () => ({}),
      detail: () => Promise.resolve({}),
    },

    ...(execution && {
      async runTurn(context) {
        const compaction = await resolveAgentTask(
          context.db,
          AGENT_TASK_IDS.sessionCompaction,
          {
            session: () => ({
              model: resolvePublicModel(
                context.settings,
                context.models,
                context.access,
                context.house
              ),
              models: context.models,
            }),
          }
        );

        return runPublicTurn({
          session: context.session,
          models: context.models,
          access: context.access,
          house: context.house,
          settings: context.settings,
          compactionModel: compaction.model,
          instructions: context.config.instructions,
          agentSessionId: context.row.id,
          content: execution.createContentPort({ db: context.db }),
          profile: execution.createProfilePort({ db: context.db }),
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
      },
    }),
  };
};
