import { os } from "@orpc/server";

import type { Session } from "@chia/auth/types";
import type { DB } from "@chia/db";
import { getAgentSession } from "@chia/db/repos/agent";

import { requireAgentKind } from "../services/agent.service";
import type {
  AgentModelRef,
  AgentKindService,
  AgentServiceCaller,
} from "../services/agent.service";
import type { BaseOSContext } from "../utils";

/**
 * Resolves a session-scoped agent request once, for every route that needs it.
 *
 * Every session route used to repeat the same four steps inline — load the row, check it is not
 * deleted, check the caller owns it, then look up the runtime for its `kind`. Twelve copies of an
 * authorization check is twelve chances for one of them to drift, and the drift would be silent:
 * a missing ownership check reads exactly like a working route.
 *
 * The kind comes from the **stored session**, never from the request, so a client cannot drive a
 * session through another kind's tools by supplying a different kind. An explicit `kind` in
 * the input is only ever a cross-check.
 *
 * Runs after `adminGuard()`, whose context it consumes.
 */

type AdminContext = BaseOSContext & {
  adminId: string;
  session: Session;
};

/** What the guard hands downstream. */
export interface AgentSessionContext {
  agent: {
    caller: AgentServiceCaller;
    service: AgentKindService;
    kind: string;
  };
}

const agentOS = os.$context<AdminContext>();

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

export const agentSessionGuard = () =>
  agentOS
    .errors({ NOT_FOUND: {}, BAD_REQUEST: {} })
    .middleware(async ({ context, errors, next }, input: AgentSessionInput) => {
      const caller: AgentServiceCaller = {
        adminId: context.adminId,
        userId: context.session.user.id,
        context,
      };

      const row = await getAgentSession(context.db as DB, input.sessionId);
      /**
       * One `NOT_FOUND` for "absent", "deleted" and "someone else's".
       *
       * Distinguishing them would let a caller probe which session ids exist, and there is nothing
       * the legitimate operator can do differently in any of the three cases anyway.
       */
      if (!row || row.deletedAt !== null || row.userId !== caller.userId) {
        throw errors.NOT_FOUND();
      }
      if (input.kind && input.kind !== row.kind) {
        throw errors.NOT_FOUND();
      }

      const service = requireAgentKind(context, row.kind);

      if (input.model) {
        const reason = await service.validateModel(input.model);
        if (reason) throw errors.BAD_REQUEST({ message: reason });
      }

      return next({
        context: { agent: { caller, service, kind: row.kind } },
      });
    });

/**
 * Model validation for routes with **no** session to resolve — creation, where the kind arrives in
 * the input because there is nothing stored to read it from.
 */
export const agentModelGuard = () =>
  agentOS
    .errors({ BAD_REQUEST: {} })
    .middleware(
      async (
        { context, errors, next },
        input: { kind: string; model?: AgentModelRef }
      ) => {
        if (input.model) {
          const reason = await requireAgentKind(
            context,
            input.kind
          ).validateModel(input.model);
          if (reason) throw errors.BAD_REQUEST({ message: reason });
        }
        return next();
      }
    );
