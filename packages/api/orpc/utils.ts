import { implement } from "@orpc/server";
import { os } from "@orpc/server";
import GithubSlugger from "github-slugger";

import type { ServiceContext } from "@chia/service-kit/context";

import { routerContract } from "./router.contract";

/**
 * oRPC handler context. Intentionally nothing more than {@link ServiceContext} plus a
 * single error sink, so mounting the handler is a spread of the Hono `c.var`.
 *
 * Domain side effects (search reindexing, …) are **not** here — they are registered
 * per app via `packages/api/orpc/events.ts`.
 */
export interface BaseOSContext extends ServiceContext {
  hooks?: {
    onError?: (error: unknown) => void;
  };
}

export const baseOS = os.$context<BaseOSContext>();

export const contractOS = implement(routerContract).$context<BaseOSContext>();

export const slugger = new GithubSlugger();

export { withMetaSchema } from "./contracts/shared";
