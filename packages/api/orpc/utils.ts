import { implement } from "@orpc/server";
import { os } from "@orpc/server";
import GithubSlugger from "github-slugger";

import type { ServiceContext } from "@chia/service-kit/context";

import { routerContract } from "./router.contract";
import type { AgentKindService } from "./services/agent.service";
import type { IndexingService } from "./services/indexing.service";

/**
 * Values the guards need that only the hosting app knows (env-driven budgets, project
 * ids, key material). Carried on the context so `packages/api` parses no env of its own.
 */
export interface ORPCConfig {
  rateLimit: {
    windowMs: number;
    /** Budget for an anonymous caller. Higher tiers multiply it — see `TIER_MULTIPLIER`. */
    limit: number;
  };
  /** Project the `X-CH-API-KEY` must belong to, when the app scopes keys per project. */
  projectId?: number;
  /** Private half of the keypair the AI provider-key cookies are encrypted with. */
  aiAuthPrivateKey?: string;
}

/**
 * Feed lifecycle hooks. Fired by the content write paths; the host that owns search
 * indexing supplies them. Absent means the process has no indexer — the write still
 * happens, nothing is scheduled.
 */
export interface FeedHooks {
  onFeedChanged?: (feedID: number) => Promise<void>;
  onFeedRemoved?: (translationIDs: readonly number[]) => Promise<void>;
}

/**
 * oRPC handler context: {@link ServiceContext} plus what the hosting process supplies.
 *
 * `config` is required — every process that runs the router has a rate-limit budget to
 * name. The ports are optional because a context need not have them: `apps/service` owns
 * the workflow runtime and wires all of these in `createORPCContext`; a context that
 * leaves one out (tests do) gets `SERVICE_UNAVAILABLE` from a route that needs it.
 */
export interface BaseOSContext extends ServiceContext {
  config: ORPCConfig;
  hooks?: FeedHooks & {
    onError?: (cause: unknown) => void;
  };
  /** Starts and reconciles resource index runs. Needs the workflow runtime. */
  indexing?: IndexingService;
  /** Agent kind services, keyed by `agent_session.kind`. */
  agentKinds?: Readonly<Record<string, AgentKindService>>;
}

export const baseOS = os.$context<BaseOSContext>();

export const contractOS = implement(routerContract).$context<BaseOSContext>();

export const slugger = new GithubSlugger();

export { withMetaSchema } from "./contracts/shared";
