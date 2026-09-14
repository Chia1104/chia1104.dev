import { COMMON_ERROR_STATUS_MAP, ORPCError } from "@orpc/server";
import type { Context } from "hono";
import * as z from "zod";

import type { BaseOSContext, ORPCConfig } from "@chia/services/shared/context";

import { agentFactory } from "../agents/factory";
import { env } from "../env";
import { workflowControl } from "../repos/workflow-control.repo";
import { memoryHooks } from "../services/agent-memory-indexing.service";
import { feedDraftBus } from "../services/feed-draft-bus.service";
import { feedHooks } from "../services/feed-indexing.service";

/** Guard config from env; built once and reused on every request. */
const config: ORPCConfig = {
  aiAuthPrivateKey: env.AI_AUTH_PRIVATE_KEY,
};

/** QUOTA_EXCEEDED is the only AppError code outside oRPC's common codes. */
export const errorStatusMap = {
  ...COMMON_ERROR_STATUS_MAP,
  QUOTA_EXCEEDED: 402,
};

const errorStatus = new Map<string, number>(Object.entries(errorStatusMap));

const errorData = z.looseObject({});

/**
 * Logs and reports a service failure once, then rethrows it carrying `requestId` in `data`
 * so the client can show a reference. A 4xx `ORPCError` answers the caller and passes
 * through unreported.
 */
export const withErrorReporting = async <T>(
  context: Pick<BaseOSContext, "hooks" | "requestId">,
  next: () => Promise<T>
): Promise<T> => {
  try {
    return await next();
  } catch (error) {
    if (
      error instanceof ORPCError &&
      (errorStatus.get(error.code) ?? 500) < 500
    ) {
      throw error;
    }

    const { requestId } = context;
    console.error("Procedure failed", { requestId, error });
    context.hooks?.onError?.(error);

    if (!(error instanceof ORPCError)) {
      throw new ORPCError("INTERNAL_SERVER_ERROR", {
        data: { requestId },
        cause: error,
      });
    }
    const data = errorData.safeParse(error.data);
    throw new ORPCError(error.code, {
      message: error.message,
      data: { ...(data.success && data.data), requestId },
      cause: error,
    });
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
      c.get("sentry").setTag("requestId", c.var.requestId);
      c.get("sentry").captureException(error);
    },
  },
  workflow: workflowControl,
  agentFactory,
  draftBus: feedDraftBus,
});
