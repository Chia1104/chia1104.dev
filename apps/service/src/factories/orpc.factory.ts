import type { Context } from "hono";

import type { BaseOSContext, ORPCConfig } from "@chia/api/orpc/utils";

import { agentFactory } from "../agents/factory";
import { env } from "../env";
import { workflowControl } from "../repos/workflow-control.repo";
import { memoryHooks } from "../services/agent-memory-indexing.service";
import { feedDraftBus } from "../services/feed-draft-bus.service";
import { feedHooks } from "../services/feed-indexing.service";

/** Guard config from env; built once and reused on every request. */
const config: ORPCConfig = {
  rateLimit: {
    windowMs: env.RATELIMIT_WINDOW_MS,
    limit: env.RATELIMIT_MAX,
  },
  aiAuthPrivateKey: env.AI_AUTH_PRIVATE_KEY,
};

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

/** Spreads Hono `Variables` because they are `ServiceContext`; then adds this process's bindings. */
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
  workflow: workflowControl,
  agentFactory,
  draftBus: feedDraftBus,
});
