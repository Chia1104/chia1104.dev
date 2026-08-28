import { implement } from "@orpc/server";
import { os } from "@orpc/server";
import GithubSlugger from "github-slugger";

import type { ServiceContext } from "@chia/service-kit/context";
import type { WorkflowControlClient } from "@chia/workflow-control/client";

import { routerContract } from "./router.contract";
import type { AgentAdminService } from "./services/agent-admin.service";
import type { AgentKindService } from "./services/agent.service";

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
 * Agent memory lifecycle hook, fired by `memories/write.ts` after every write. One hook
 * covers create, update and removal: the index run reads the row and clears the chunks of
 * a memory that is gone or archived, so the writer never has to say which it was.
 */
export interface MemoryHooks {
  onMemoryChanged?: (memoryId: number) => Promise<void>;
}

/**
 * oRPC handler context: {@link ServiceContext} plus what the hosting process supplies.
 *
 * `config` and `workflow` are required — every process that runs the router has a
 * rate-limit budget to name and a workflow service to send runs to. The agent ports are
 * optional because a context need not have them: `apps/service` owns the kind and task
 * registries and wires them in `createORPCContext`; a context that leaves one out (tests
 * do) gets `SERVICE_UNAVAILABLE` from a route that needs it.
 */
export interface BaseOSContext extends ServiceContext {
  config: ORPCConfig;
  /**
   * The `apps/workflow` client. Routes start runs, cancel them and read their state with it
   * directly — the World itself lives behind that service, never in this package.
   */
  workflow: WorkflowControlClient;
  hooks?: FeedHooks &
    MemoryHooks & {
      onError?: (cause: unknown) => void;
    };
  /** Agent kind services, keyed by `agent.session.kind`. */
  agentKinds?: Readonly<Record<string, AgentKindService>>;
  /** Operator configuration of kinds and tasks. Needs the host's registries. */
  agentAdmin?: AgentAdminService;
}

export const baseOS = os.$context<BaseOSContext>();

export const contractOS = implement(routerContract).$context<BaseOSContext>();

export const slugger = new GithubSlugger();

export { withMetaSchema } from "./contracts/shared";
