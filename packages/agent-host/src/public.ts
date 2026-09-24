import { contentReadToolSpecs } from "@chia/agent-content/tools/read";
import type {
  ContentReadPort,
  ProfileReadPort,
  WebPort,
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
import type { ReportPort } from "@chia/agent-public/ports";
import { preparePublicTurn } from "@chia/agent-public/runtime";
import { publicReportToolSpecs } from "@chia/agent-public/tools/report";
import { publicWebToolSpecs } from "@chia/agent-public/tools/web";
import type { GuardProvider } from "@chia/ai/guard/provider";
import { CallerTier } from "@chia/auth/tier";
import type { DB } from "@chia/db/client";
import { getFeedById } from "@chia/db/repos/feeds";
import { AppError, AppErrorCode } from "@chia/service-kit/errors";

import { toolCapabilities } from "./kind";
import type { AgentKindDefinition, AgentKindExecutor } from "./kind";

/**
 * Binds `@chia/agent-public` to the host: a `public`-visibility content port, plus web access
 * and reporting for a signed-in owner. It keeps no row beside `agent.session`: a public session
 * is its transcript.
 */

/** No extension row; the loaded state is an empty object so the session stays visible. */
export type PublicAgentState = Record<string, never>;

type PublicAgentKind = AgentKindDefinition<PublicAgentState, PublicConfig>;

export interface PublicExecutionHost {
  /** Must be built with `public` visibility; the kind cannot check that, only rely on it. */
  createContentPort(options: { db: DB }): ContentReadPort;
  /** Published rows only, for the same reason. */
  createProfilePort(options: { db: DB }): ProfileReadPort;
  /** Null runs the kind unguarded, and without web access whatever the config says. */
  guard: GuardProvider | null;
  createWebPort(): WebPort;
  /** Files reports as `reporterId`; only ever built for a signed-in owner. */
  createReportPort(options: {
    db: DB;
    reporterId: string;
    sessionId: string;
  }): ReportPort;
  /** Whether the session's owner is a signed-in person rather than a guest. */
  isSignedIn(options: { db: DB; userId: string }): Promise<boolean>;
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
      tools: toolCapabilities(
        [
          ...contentReadToolSpecs,
          ...publicWebToolSpecs,
          ...publicReportToolSpecs,
        ],
        publicPolicy
      ),
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
        if (attachment.type === "draft" || attachment.type === "report") {
          throw new AppError(AppErrorCode.BadRequest, {
            message: `The public agent takes no "${attachment.type}" attachments.`,
          });
        }
        if (
          attachment.type === "selection" &&
          attachment.source.type !== "feed"
        ) {
          throw new AppError(AppErrorCode.BadRequest, {
            message: `The public agent takes no "${attachment.source.type}" selections.`,
          });
        }
        const feedId =
          attachment.type === "feed" ? attachment.id : attachment.source.id;
        const feed = await getFeedById(db, { feedId, published: true });
        if (!feed) {
          throw new AppError(AppErrorCode.NotFound, {
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

  async prepareTurn(context) {
    const { db, row } = context;
    const signedIn = await host.isSignedIn({ db, userId: row.userId });
    const web =
      signedIn && context.config.webAccess === true && host.guard !== null;

    return preparePublicTurn({
      content: host.createContentPort({ db }),
      profile: host.createProfilePort({ db }),
      instructions: context.config.instructions,
      guard: host.guard,
      web: web ? host.createWebPort() : undefined,
      report: signedIn
        ? host.createReportPort({
            db,
            reporterId: row.userId,
            sessionId: row.id,
          })
        : undefined,
    });
  },
});
