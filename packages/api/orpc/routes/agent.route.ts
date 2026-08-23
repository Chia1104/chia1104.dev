import type { AgentWireEvent } from "@chia/agent-runtime/wire/schema";

import {
  agentCallerOf,
  agentKindGuard,
  agentSessionGuard,
  canUseAgentKind,
} from "../guards/agent-session.guard";
import { callerGuard } from "../guards/caller.guard";
import {
  availableAgentKinds,
  requireAgentKind,
} from "../services/agent.service";
import type { AgentKindService } from "../services/agent.service";
import { contractOS } from "../utils";

/**
 * Agent routes.
 *
 * Thin by design: creation/capability requests resolve by an explicit kind, while session-scoped
 * requests resolve from the persisted session. A client cannot drive a session through another
 * kind's tools by supplying a different kind.
 *
 * `callerGuard()` only resolves the tier; who may use a kind is that kind's `minTier`, enforced by
 * `agentKindGuard()` / `agentSessionGuard()`. The writing kind pins to the configured admin because
 * its tools write to and publish the blog; a public kind admits any session-bearing visitor. The
 * routes stay shared because the guards, not the routes, know the difference.
 *
 * `agentSessionGuard()` owns session resolution and ownership for every session-scoped route, so
 * the handlers below are left with only their own work — see the guard for why that is not merely
 * tidier.
 */

const resolveCaller = callerGuard();

// ============================================
// Sessions
// ============================================

/**
 * The one route whose kind is optional, so it resolves access inline: an explicit kind the caller
 * may not use is refused, an omitted kind lists whichever kinds the caller may use.
 */
export const listAgentSessionsRoute = contractOS.agent.sessions.list
  .use(resolveCaller)
  .handler(async (opts) => {
    const agentCaller = agentCallerOf(opts.context, opts.errors);
    let services: AgentKindService[];
    if (opts.input?.kind) {
      const service = requireAgentKind(opts.context, opts.input.kind);
      if (!canUseAgentKind(agentCaller, service)) throw opts.errors.FORBIDDEN();
      services = [service];
    } else {
      services = availableAgentKinds(opts.context)
        .map((kind) => requireAgentKind(opts.context, kind))
        .filter((service) => canUseAgentKind(agentCaller, service));
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

// ============================================
// Turns
// ============================================

/**
 * The durable stream stays open for the run's whole life; a chat request is scoped to one turn, so
 * it ends at that turn's `run:end` — which `runPiTurn` always emits, after any `error`.
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
      cursor = await service.prompt(caller, {
        sessionId: opts.input.sessionId,
        text: action.text,
      });
    } else if (action.type === "command") {
      const capabilities = await service.listCapabilities();
      if (
        !capabilities.commands.some((command) => command.name === action.name)
      ) {
        throw opts.errors.BAD_REQUEST({
          message: `Unknown agent command: /${action.name}`,
        });
      }
      cursor = await service.prompt(caller, {
        sessionId: opts.input.sessionId,
        text: action.text,
        template: { name: action.name, args: action.args },
      });
    } else if (action.type === "approve") {
      cursor = await service.approve(caller, {
        sessionId: opts.input.sessionId,
        toolCallId: action.toolCallId,
        approved: action.approved,
        comment: action.comment,
      });
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
        deltas: true,
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
    const cursor = await service.approve(caller, opts.input);
    if (!cursor) throw opts.errors.NOT_FOUND();
    return {
      toolCallId: opts.input.toolCallId,
      approved: opts.input.approved,
    };
  });

// ============================================
// Session maintenance
// ============================================

export const compactAgentSessionRoute = contractOS.agent.sessions.compact
  .use(resolveCaller)
  .use(agentSessionGuard())
  .handler(async (opts) => {
    const { caller, service } = opts.context.agent;
    const result = await service.compact(caller, opts.input);
    if (!result) throw opts.errors.NOT_FOUND();
    return result;
  });

export const navigateAgentSessionRoute = contractOS.agent.sessions.navigate
  .use(resolveCaller)
  .use(agentSessionGuard())
  .handler(async (opts) => {
    const { caller, service } = opts.context.agent;
    const result = await service.navigate(caller, opts.input);
    if (!result) throw opts.errors.NOT_FOUND();
    return result;
  });

export const getAgentDraftRoute = contractOS.agent.sessions.draft
  .use(resolveCaller)
  .use(agentSessionGuard())
  .handler(async (opts) => {
    const { caller, service } = opts.context.agent;
    const draft = await service.getDraft?.(caller, opts.input);
    if (!draft) throw opts.errors.NOT_FOUND();
    return draft;
  });

// ============================================
// Capabilities
// ============================================

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
