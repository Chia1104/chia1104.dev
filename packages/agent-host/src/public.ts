import { contentReadToolSpecs } from "@chia/agent-content/tools/read";
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
import { preparePublicTurn } from "@chia/agent-public/runtime";
import { CallerTier } from "@chia/auth/tier";
import type { DB } from "@chia/db/client";
import { getFeedById } from "@chia/db/repos/feeds";
import { AppError } from "@chia/service-kit/errors";

import type { AgentKindDefinition, AgentKindExecutor } from "./kind";

/**
 * Binds `@chia/agent-public` to the host: a `public`-visibility content port and nothing else.
 * It keeps no row beside `agent.session`: a public session is its transcript.
 */

/** No extension row; the loaded state is an empty object so the session stays visible. */
export type PublicAgentState = Record<string, never>;

type PublicAgentKind = AgentKindDefinition<PublicAgentState, PublicConfig>;

export interface PublicExecutionHost {
  /** Must be built with `public` visibility; the kind cannot check that, only rely on it. */
  createContentPort(options: { db: DB }): ContentReadPort;
  /** Published rows only, for the same reason. */
  createProfilePort(options: { db: DB }): ProfileReadPort;
}

export const createPublicAgentKind = (): PublicAgentKind => ({
  kind: PUBLIC_AGENT_KIND,
  label: "Reader",
  description:
    "Answers visitors' questions about the author and the published posts, on the public site.",

  /**
   * Anyone with a user row; the operator raises this per deployment through the kind's
   * config. Lower tiers are metered by the shared weekly allowance and the running-turn
   * cap; only `Root` is not.
   */
  minTier: CallerTier.Guest,
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
      tools: contentReadToolSpecs.map((spec) => ({
        name: spec.name,
        label: spec.label,
        tier: publicPolicy.toolInfo(spec.name).tier,
        description: spec.description,
      })),
      commands: [],
      skills: [],
    };
  },

  state: {
    create: () => Promise.resolve(),
    load: () => Promise.resolve({}),
    fork: () => Promise.resolve(),
    detail: () => Promise.resolve({}),

    /**
     * Only a published post: the one the visitor is reading, or text selected in one. Checked
     * here so an unpublished id fails the request instead of the turn, and so an attachment
     * cannot probe what the visitor cannot read.
     */
    async attach(_caller, db, _sessionId, attachments) {
      for (const attachment of attachments) {
        if (attachment.type === "draft") {
          throw new AppError("BAD_REQUEST", {
            message: `The public agent takes no "draft" attachments.`,
          });
        }
        if (
          attachment.type === "selection" &&
          attachment.source.type !== "feed"
        ) {
          throw new AppError("BAD_REQUEST", {
            message: `The public agent takes no "${attachment.source.type}" selections.`,
          });
        }
        const feedId =
          attachment.type === "feed" ? attachment.id : attachment.source.id;
        const feed = await getFeedById(db, { feedId, published: true });
        if (!feed) {
          throw new AppError("NOT_FOUND", {
            message: `Unknown post: ${feedId}`,
          });
        }
      }
    },
  },
});

export const createPublicAgentExecutor = (
  host: PublicExecutionHost
): AgentKindExecutor<PublicAgentState, PublicConfig> => ({
  ...createPublicAgentKind(),

  prepareTurn: (context) =>
    preparePublicTurn({
      content: host.createContentPort({ db: context.db }),
      profile: host.createProfilePort({ db: context.db }),
      instructions: context.config.instructions,
    }),
});
