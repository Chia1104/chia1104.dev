import type { Context } from "hono";

import type { BaseOSContext, ORPCConfig } from "@chia/api/orpc/utils";

import { agentKinds } from "../agents/registry";
import { env } from "../env";
import { memoryHooks } from "../services/agent-memory-indexing.service";
import { feedHooks } from "../services/feed-indexing.service";
import { memoryService } from "../services/memory-consolidation.service";
import { ragIndexingService } from "../services/rag-indexing.service";

/** The values the guards read from this app's env. Built once; the same on every request. */
const config: ORPCConfig = {
  rateLimit: {
    windowMs: env.RATELIMIT_WINDOW_MS,
    limit: env.RATELIMIT_MAX,
  },
  projectId: env.PROJECT_ID,
  aiAuthPrivateKey: env.AI_AUTH_PRIVATE_KEY,
};

/**
 * Wraps a handler invocation with the error reporting the oRPC handler applies to every
 * procedure.
 */
export const withErrorReporting = async <T>(
  context: Pick<BaseOSContext, "hooks">,
  next: () => Promise<T>
): Promise<T> => {
  try {
    return await next();
  } catch (error) {
    console.error(error);
    context.hooks?.onError?.(error);
    throw error;
  }
};

/**
 * Builds the oRPC handler context from a Hono context.
 *
 * `BaseOSContext` extends `ServiceContext`, which is exactly the Hono `Variables` —
 * hence the spread rather than a field-by-field mapping. Everything after the spread is
 * what this process supplies on top: its env-derived config, and — because it is the only
 * process with a workflow runtime — the ports that index feeds and memories, start index
 * runs and run agent turns.
 */
export const createORPCContext = (c: Context<HonoContext>): BaseOSContext => ({
  ...c.var,
  config,
  hooks: {
    ...feedHooks,
    ...memoryHooks,
    onError(error) {
      c.get("sentry").captureException(error);
    },
  },
  indexing: ragIndexingService,
  memory: memoryService,
  agentKinds,
});
