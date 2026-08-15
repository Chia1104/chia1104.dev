import { implement } from "@orpc/server";
import { os } from "@orpc/server";
import GithubSlugger from "github-slugger";

import type { ServiceContext } from "@chia/service-kit/context";

import type { AgentKindService } from "./agent-service";
import type { IndexingService } from "./indexing";
import { routerContract } from "./router.contract";

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
 * Every field beyond `ServiceContext` is optional because not every process that runs
 * the router has it: `apps/service` owns the workflow runtime and wires all of these in
 * `createORPCContext`; the dashboard's in-process router client leaves them out, and a
 * route that needs one answers `SERVICE_UNAVAILABLE`.
 */
export interface BaseOSContext extends ServiceContext {
  hooks?: FeedHooks & {
    onError?: (error: unknown) => void;
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
