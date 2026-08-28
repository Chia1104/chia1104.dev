import { os } from "@orpc/server";

import type { DB } from "@chia/db/client";
import { getAgentSession } from "@chia/db/repos/agent";
import { CallerTier } from "@chia/service-kit/policies/caller.policy";

import { requireAgentKind } from "../services/agent.service";
import type {
  AgentModelRef,
  AgentKindService,
  AgentServiceCaller,
} from "../services/agent.service";

import type { CallerContext } from "./caller.guard";

/**
 * Agent guards. Both run after `callerGuard()`, whose resolved `caller` they consume, and both
 * hand the same `agent` context downstream so every handler reads one shape.
 *
 * Which tier may use a kind is the kind's own policy (`AgentKindService.minTier`), so neither guard
 * hard-codes a role: the writing kind pins to the configured admin, a public kind admits any
 * session-bearing visitor, and the routes are shared between them.
 */

/** What the guards hand downstream. */
export interface AgentSessionContext {
  agent: {
    caller: AgentServiceCaller;
    service: AgentKindService;
    kind: string;
  };
}

const agentOS = os.$context<CallerContext>();

/**
 * Whether `caller` may use `service` at all. Written once because the two guards and the
 * kind-less list route each need the same answer.
 */
export const canUseAgentKind = (
  caller: AgentServiceCaller,
  service: AgentKindService
): boolean => caller.tier >= service.minTier;

/**
 * The subset of a route's input this guard reads.
 *
 * Declared narrowly on purpose: oRPC checks the middleware's parameter against each procedure's
 * input, so anything wider would refuse to compose with routes that do not carry it.
 */
interface AgentSessionInput {
  sessionId: string;
  kind?: string;
  model?: AgentModelRef;
}

/**
 * Resolves a session-scoped agent request once, for every route that needs it.
 *
 * Every session route used to repeat the same steps inline — load the row, check it is not
 * deleted, check the caller owns it, then look up the runtime for its `kind`. Twelve copies of an
 * authorization check is twelve chances for one of them to drift, and the drift would be silent:
 * a missing ownership check reads exactly like a working route.
 *
 * The kind comes from the **stored session**, never from the request, so a client cannot drive a
 * session through another kind's tools by supplying a different kind. An explicit `kind` in
 * the input is only ever a cross-check.
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
       * One `NOT_FOUND` for "absent", "deleted" and "someone else's".
       *
       * Distinguishing them would let a caller probe which session ids exist, and there is nothing
       * the legitimate operator can do differently in any of the three cases anyway. Ownership is
       * checked before tier for the same reason: a lower-tier caller learns nothing about sessions
       * of a kind it cannot use.
       */
      if (!row || row.deletedAt !== null || row.userId !== caller.userId) {
        throw errors.NOT_FOUND();
      }
      if (input.kind && input.kind !== row.kind) {
        throw errors.NOT_FOUND();
      }

      const service = requireAgentKind(context, row.kind);
      if (!canUseAgentKind(caller, service)) throw errors.FORBIDDEN();

      if (input.model) {
        const reason = await service.validateModel(input.model);
        if (reason) throw errors.BAD_REQUEST({ message: reason });
      }

      return next({
        context: { agent: { caller, service, kind: row.kind } },
      });
    });

/**
 * Resolves a request that names its kind explicitly because it has **no** session to read it
 * from — creation, and the capability listings.
 */
export const agentKindGuard = () =>
  agentOS
    .errors({ UNAUTHORIZED: {}, FORBIDDEN: {}, BAD_REQUEST: {} })
    .middleware(
      async (
        { context, errors, next },
        input: { kind: string; model?: AgentModelRef }
      ) => {
        const caller = agentCallerOf(context, errors);
        const service = requireAgentKind(context, input.kind);
        if (!canUseAgentKind(caller, service)) throw errors.FORBIDDEN();

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
 * The caller every agent route needs: a resolved tier plus a session user to own things.
 *
 * `callerGuard()` alone admits anonymous and API-key callers, and both are legitimate on other
 * routes; here they have no user to own a session, so they are refused before any lookup. A
 * guest does have one — that is what the guest row is for — so `Guest` is the floor; which
 * kinds a guest may then use is each kind's `minTier`. Exported for the routes (`list`,
 * `usage.me`) that have no kind to resolve through a guard.
 */
export const agentCallerOf = (
  context: CallerContext,
  errors: { UNAUTHORIZED: () => Error }
): AgentServiceCaller => {
  const { caller } = context;
  if (!caller.session || caller.tier < CallerTier.Guest) {
    throw errors.UNAUTHORIZED();
  }
  return { ...caller, userId: caller.session.user.id, context };
};
