import { implement } from "@orpc/server";
import { os } from "@orpc/server";
import GithubSlugger from "github-slugger";

import type { ServiceContext } from "@chia/service-kit/context";
import type { WorkflowControlClient } from "@chia/workflow-control/client";

import type { FeedDraftBus } from "../feeds/draft-bus";

import { routerContract } from "./router.contract";
import type { AgentFactory } from "./services/agent.factory";

/**
 * Values the guards need that only the hosting app knows. Carried on the context so
 * `packages/api` parses no env of its own.
 */
export interface ORPCConfig {
  rateLimit: {
    windowMs: number;
    /** Budget for an anonymous caller. Higher tiers multiply it — see `TIER_MULTIPLIER`. */
    limit: number;
  };
  /** Private half of the keypair the AI provider-key cookies are encrypted with. */
  aiAuthPrivateKey?: string;
}

/**
 * Feed lifecycle hooks. Fired by content write paths; the host that owns search indexing
 * supplies them. Absent means the write still happens, nothing is scheduled.
 */
export interface FeedHooks {
  onFeedChanged?: (feedID: number) => Promise<void>;
  onFeedRemoved?: (translationIDs: readonly number[]) => Promise<void>;
}

/**
 * Fired by `memories/write.ts` after every write. One hook covers create, update and
 * removal: the index run reads the row and clears chunks of a memory that is gone or
 * archived.
 */
export interface MemoryHooks {
  onMemoryChanged?: (memoryId: number) => Promise<void>;
}

/**
 * {@link ServiceContext} plus what the hosting process supplies. `config` and `workflow`
 * are required. The agent factory is optional; an agent route then answers
 * `SERVICE_UNAVAILABLE`.
 */
export interface BaseOSContext extends ServiceContext {
  config: ORPCConfig;
  /**
   * The `apps/workflow` client. The World lives behind that service, never in this package.
   */
  workflow: WorkflowControlClient;
  hooks?: FeedHooks &
    MemoryHooks & {
      onError?: (cause: unknown) => void;
    };
  /** Typed constructor for kind services, admin views and quota standing. */
  agentFactory?: AgentFactory;
  /**
   * Live `feed_draft` notices for `feeds.draft:watch`. Absent, a watch still works: it falls
   * back to polling the revision trail.
   */
  draftBus?: FeedDraftBus;
}

export const baseOS = os.$context<BaseOSContext>();

export const contractOS = implement(routerContract).$context<BaseOSContext>();

export const slugger = new GithubSlugger();

export { withMetaSchema } from "./contracts/shared";
