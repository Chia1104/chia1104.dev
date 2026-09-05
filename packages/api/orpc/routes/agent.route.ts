import type { AgentWireEvent } from "@chia/agent-runtime/wire/schema";
import { withORPCErrors } from "@chia/service-kit/adapters/orpc";

import {
  agentCallerOf,
  agentKindGuard,
  agentSessionGuard,
  canUseAgentKind,
} from "../guards/agent-session.guard";
import { callerGuard } from "../guards/caller.guard";
import {
  availableAgentKinds,
  requireAgentFactory,
  requireAgentKind,
  requireAgentKindTier,
} from "../services/agent.service";
import type { AgentKindService } from "../services/agent.service";
import { contractOS } from "../utils";

/**
 * Creation and capability requests resolve by an explicit kind; session-scoped requests resolve
 * from the stored session, so a client cannot drive a session through another kind's tools.
 * Who may use a kind is that kind's `minTier`, not `callerGuard()`.
 */

const resolveCaller = callerGuard();

/**
 * Kind is optional here: an explicit kind the caller may not use is refused; an omitted kind
 * lists whichever kinds the caller may use.
 */
export const listAgentSessionsRoute = contractOS.agent.sessions.list
  .use(resolveCaller)
  .handler(async (opts) => {
    const agentCaller = agentCallerOf(opts.context, opts.errors);
    let services: AgentKindService[];
    if (opts.input?.kind) {
      const tier = requireAgentKindTier(opts.context, opts.input.kind);
      if (!canUseAgentKind(agentCaller, tier)) throw opts.errors.FORBIDDEN();
      services = [await requireAgentKind(opts.context, opts.input.kind)];
    } else {
      // Tier-filter on the eager floor first, so a kind the caller cannot use is never loaded.
      services = await Promise.all(
        availableAgentKinds(opts.context)
          .filter((kind) =>
            canUseAgentKind(
              agentCaller,
              requireAgentKindTier(opts.context, kind)
            )
          )
          .map((kind) => requireAgentKind(opts.context, kind))
      );
    }
    const pages = await Promise.all(
      services.map((service) => service.listSessions(agentCaller, opts.input))
    );
    const limit = opts.input?.limit ?? 50;
    return {
      items: pages
        .flatMap((page) => page.items)
        .sort((a, b) => b.updatedAt - a.updatedAt)
        .slice(0, limit),
      nextCursor: null,
    };
  });

export const createAgentSessionRoute = contractOS.agent.sessions.create
  .use(resolveCaller)
  .use(agentKindGuard())
  .handler(async (opts) => {
    const { caller, service } = opts.context.agent;
    return await service.createSession(caller, opts.input);
  });

export const getAgentSessionRoute = contractOS.agent.sessions.get
  .use(resolveCaller)
  .use(agentSessionGuard())
  .handler(async (opts) => {
    const { caller, service } = opts.context.agent;
    const detail = await service.getSession(caller, opts.input);
    if (!detail) throw opts.errors.NOT_FOUND();
    return detail;
  });

export const deleteAgentSessionRoute = contractOS.agent.sessions.delete
  .use(resolveCaller)
  .use(agentSessionGuard())
  .handler(async (opts) => {
    const { caller, service } = opts.context.agent;
    const deleted = await service.deleteSession(caller, opts.input);
    if (!deleted) throw opts.errors.NOT_FOUND();
    return { sessionId: opts.input.sessionId };
  });

export const updateAgentSessionSettingsRoute = contractOS.agent.sessions[
  "settings:update"
]
  .use(resolveCaller)
  .use(agentSessionGuard())
  .handler(async (opts) => {
    const { caller, service } = opts.context.agent;
    const detail = await service.updateSettings(caller, opts.input);
    if (!detail) throw opts.errors.NOT_FOUND();
    return detail;
  });

/**
 * The durable stream stays open for the run's whole life; a chat request ends at that turn's
 * `run:end`, which `runPiTurn` always emits after any `error`.
 */
const oneTurn = async function* (
  events: AsyncIterable<AgentWireEvent>
): AsyncGenerator<AgentWireEvent, void, void> {
  for await (const event of events) {
    yield event;
    if (event.type === "run:end") return;
  }
};

export const chatAgentRoute = contractOS.agent.sessions.chat
  .use(resolveCaller)
  .use(agentSessionGuard())
  .handler(async (opts) => {
    const { caller, service } = opts.context.agent;

    const { action } = opts.input;
    let cursor;
    if (action.type === "prompt") {
      cursor = await withORPCErrors(() =>
        service.prompt(caller, {
          sessionId: opts.input.sessionId,
          text: action.text,
          attachments: action.attachments,
        })
      );
    } else if (action.type === "command") {
      const capabilities = await service.listCapabilities();
      if (
        !capabilities.commands.some((command) => command.name === action.name)
      ) {
        throw opts.errors.BAD_REQUEST({
          message: `Unknown agent command: /${action.name}`,
        });
      }
      cursor = await withORPCErrors(() =>
        service.prompt(caller, {
          sessionId: opts.input.sessionId,
          text: action.text,
          template: { name: action.name, args: action.args },
          attachments: action.attachments,
        })
      );
    } else if (action.type === "approve") {
      cursor = await withORPCErrors(() =>
        service.approve(caller, {
          sessionId: opts.input.sessionId,
          toolCallId: action.toolCallId,
          approved: action.approved,
          comment: action.comment,
        })
      );
    } else {
      cursor = await service.attach(caller, {
        sessionId: opts.input.sessionId,
      });
    }
    if (!cursor) throw opts.errors.NOT_FOUND();

    return oneTurn(
      service.stream(caller, {
        sessionId: opts.input.sessionId,
        runId: cursor.runId,
        startIndex: cursor.startIndex,
        deltaStartIndex: cursor.deltaStartIndex,
      })
    );
  });

export const abortAgentRoute = contractOS.agent.sessions.abort
  .use(resolveCaller)
  .use(agentSessionGuard())
  .handler(async (opts) => {
    const { caller, service } = opts.context.agent;
    return { aborted: await service.abort(caller, opts.input) };
  });

export const approveAgentToolRoute = contractOS.agent.sessions.approve
  .use(resolveCaller)
  .use(agentSessionGuard())
  .handler(async (opts) => {
    const { caller, service } = opts.context.agent;
    const cursor = await withORPCErrors(() =>
      service.approve(caller, opts.input)
    );
    if (!cursor) throw opts.errors.NOT_FOUND();
    return {
      toolCallId: opts.input.toolCallId,
      approved: opts.input.approved,
    };
  });

export const compactAgentSessionRoute = contractOS.agent.sessions.compact
  .use(resolveCaller)
  .use(agentSessionGuard())
  .handler(async (opts) => {
    const { caller, service } = opts.context.agent;
    const result = await withORPCErrors(() =>
      service.compact(caller, opts.input)
    );
    if (!result) throw opts.errors.NOT_FOUND();
    return result;
  });

export const navigateAgentSessionRoute = contractOS.agent.sessions.navigate
  .use(resolveCaller)
  .use(agentSessionGuard())
  .handler(async (opts) => {
    const { caller, service } = opts.context.agent;
    const detail = await withORPCErrors(() =>
      service.navigate(caller, opts.input)
    );
    if (!detail) throw opts.errors.NOT_FOUND();
    return detail;
  });

export const forkAgentSessionRoute = contractOS.agent.sessions.fork
  .use(resolveCaller)
  .use(agentSessionGuard())
  .handler(async (opts) => {
    const { caller, service } = opts.context.agent;
    const detail = await withORPCErrors(() => service.fork(caller, opts.input));
    if (!detail) throw opts.errors.NOT_FOUND();
    return detail;
  });

/** No kind to resolve: the standing is the caller's own, so only the caller floor applies. */
export const getAgentUsageRoute = contractOS.agent.usage.me
  .use(resolveCaller)
  .handler(async (opts) => {
    const caller = agentCallerOf(opts.context, opts.errors);
    const usage = await requireAgentFactory(opts.context).createUsage();
    return await usage.standing(caller);
  });

export const listAgentModelsRoute = contractOS.agent.models.list
  .use(resolveCaller)
  .use(agentKindGuard())
  .handler(async (opts) => {
    const { caller, service } = opts.context.agent;
    return await service.listModels(caller);
  });

export const listAgentCapabilitiesRoute = contractOS.agent.capabilities.list
  .use(resolveCaller)
  .use(agentKindGuard())
  .handler(async (opts) => await opts.context.agent.service.listCapabilities());
