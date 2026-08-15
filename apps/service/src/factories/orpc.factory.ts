import type { Context } from "hono";

import { configureORPC } from "@chia/api/orpc/config";
import type { BaseOSContext } from "@chia/api/orpc/utils";

import { env } from "../env";
import { agentKinds } from "../services/agent.service";
import { feedHooks } from "../services/feed-indexing.service";
import { ragIndexingService } from "../services/rag-indexing.service";

/**
 * Hands the oRPC guards the values this app owns. Registered once at module load so
 * `packages/api` needs no env parsing of its own.
 */
configureORPC({
  rateLimit: {
    windowMs: env.RATELIMIT_WINDOW_MS,
    limit: env.RATELIMIT_MAX,
  },
  projectId: env.PROJECT_ID,
  aiAuthPrivateKey: env.AI_AUTH_PRIVATE_KEY,
});

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
 * what this process supplies on top: it is the only one with a workflow runtime, so it
 * is the only one that can index feeds, start index runs, or run an agent turn. The
 * dashboard's in-process router client builds its context without these.
 */
export const createORPCContext = (c: Context<HonoContext>): BaseOSContext => ({
  ...c.var,
  hooks: {
    ...feedHooks,
    onError(error) {
      c.get("sentry").captureException(error);
    },
  },
  indexing: ragIndexingService,
  agentKinds,
});
