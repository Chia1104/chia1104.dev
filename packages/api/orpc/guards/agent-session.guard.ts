import { os } from "@orpc/server";

import type { DB } from "@chia/db/client";
import { getAgentSession } from "@chia/db/repos/agent";
import { CallerTier } from "@chia/service-kit/policies/caller.policy";

import {
  requireAgentKind,
  requireAgentKindTier,
} from "../services/agent.service";
import type {
  AgentModelRef,
  AgentKindService,
  AgentServiceCaller,
} from "../services/agent.service";

import type { CallerContext } from "./caller.guard";

/**
 * Both run after `callerGuard()`. Which tier may use a kind is that kind's registered
 * `minTier`; neither guard hard-codes a role.
 */

export interface AgentSessionContext {
  agent: {
    caller: AgentServiceCaller;
    service: AgentKindService;
    kind: string;
  };
}

const agentOS = os.$context<CallerContext>();

/**
 * Asked before the kind's definition is loaded. Used by both guards and the kind-less list
 * route.
 */
export const canUseAgentKind = (
  caller: AgentServiceCaller,
  minTier: CallerTier
): boolean => caller.tier >= minTier;

/**
 * Declared narrowly: oRPC checks the middleware's parameter against each procedure's input,
 * so anything wider would refuse to compose with routes that do not carry it.
 */
interface AgentSessionInput {
  sessionId: string;
  kind?: string;
  model?: AgentModelRef;
}

/**
 * Kind comes from the stored session, never the request. An explicit `kind` in the input is
 * only a cross-check.
 */
export const agentSessionGuard = () =>
  agentOS
    .errors({ UNAUTHORIZED: {}, FORBIDDEN: {}, NOT_FOUND: {}, BAD_REQUEST: {} })
    .middleware(async ({ context, errors, next }, input: AgentSessionInput) => {
      const caller = agentCallerOf(context, errors);

      const row = await getAgentSession(
        /* SAFETY: The producer contract guarantees this value satisfies DB. */ context.db as DB,
        input.sessionId
      );
      /**
       * One `NOT_FOUND` for absent, deleted and someone else's, so a caller cannot probe
       * which session ids exist. Ownership is checked before tier for the same reason.
       */
      if (!row || row.deletedAt !== null || row.userId !== caller.userId) {
        throw errors.NOT_FOUND();
      }
      if (input.kind && input.kind !== row.kind) {
        throw errors.NOT_FOUND();
      }

      if (!canUseAgentKind(caller, requireAgentKindTier(context, row.kind))) {
        throw errors.FORBIDDEN();
      }
      const service = await requireAgentKind(context, row.kind);

      if (input.model) {
        const reason = await service.validateModel(input.model);
        if (reason) throw errors.BAD_REQUEST({ message: reason });
      }

      return next({
        context: { agent: { caller, service, kind: row.kind } },
      });
    });

/** Resolves a request that names its kind because it has no session to read it from. */
export const agentKindGuard = () =>
  agentOS
    .errors({ UNAUTHORIZED: {}, FORBIDDEN: {}, BAD_REQUEST: {} })
    .middleware(
      async (
        { context, errors, next },
        input: { kind: string; model?: AgentModelRef }
      ) => {
        const caller = agentCallerOf(context, errors);
        if (
          !canUseAgentKind(caller, requireAgentKindTier(context, input.kind))
        ) {
          throw errors.FORBIDDEN();
        }
        const service = await requireAgentKind(context, input.kind);

        if (input.model) {
          const reason = await service.validateModel(input.model);
          if (reason) throw errors.BAD_REQUEST({ message: reason });
        }

        return next({
          context: { agent: { caller, service, kind: input.kind } },
        });
      }
    );

/**
 * `callerGuard()` admits anonymous and plain API-key callers; they have no user to own a
 * session. Guest is the floor. A key lifted to Root by `operator:root` owns sessions as the
 * admin it belongs to. Exported for `list` and `usage.me`, which have no kind to resolve.
 */
export const agentCallerOf = (
  context: CallerContext,
  errors: { UNAUTHORIZED: () => Error }
): AgentServiceCaller => {
  const { caller } = context;
  const userId =
    caller.session?.user.id ??
    (caller.tier >= CallerTier.Root ? caller.apiKey?.referenceId : undefined);
  if (userId === undefined || caller.tier < CallerTier.Guest) {
    throw errors.UNAUTHORIZED();
  }
  return { ...caller, userId, context };
};
