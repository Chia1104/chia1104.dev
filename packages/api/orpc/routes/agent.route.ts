import { toTanStackAgentEventStream } from "@chia/agent-runtime/transports/tanstack-ai";

import { getAgentRuntime, registeredAgentKinds } from "../agent-runtime";
import type { AgentRuntimeCaller } from "../agent-runtime";
import { adminGuard } from "../guards/admin.guard";
import {
  agentModelGuard,
  agentSessionGuard,
} from "../guards/agent-session.guard";
import { contractOS } from "../utils";

/**
 * Agent routes.
 *
 * Thin by design: creation/capability requests resolve by an explicit kind, while session-scoped
 * requests resolve from the persisted session. A client cannot drive a session through another
 * kind's tools by supplying a different registry key.
 *
 * `adminGuard()` pins to the configured admin id, so a logged-in non-admin cannot reach these even
 * with a valid session. That matters more here than on the read routes: these tools can write to
 * and publish the blog.
 *
 * `agentSessionGuard()` then owns session resolution and ownership for every session-scoped route,
 * so the handlers below are left with only their own work — see the guard for why that is not
 * merely tidier.
 */

const callerOf = (opts: {
  context: { adminId: string; session: { user: { id: string } } };
}): AgentRuntimeCaller => ({
  adminId: opts.context.adminId,
  userId: opts.context.session.user.id,
  context: opts.context as unknown as AgentRuntimeCaller["context"],
});

// ============================================
// Sessions
// ============================================

export const listAgentSessionsRoute = contractOS.agent.sessions.list
  .use(adminGuard())
  .handler(async (opts) => {
    const caller = callerOf(opts);
    const kinds = opts.input?.kind ? [opts.input.kind] : registeredAgentKinds();
    const pages = await Promise.all(
      kinds.map((kind) =>
        getAgentRuntime(kind).listSessions(caller, opts.input)
      )
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

/** The one session route with no session to resolve, so it validates the model on its own. */
export const createAgentSessionRoute = contractOS.agent.sessions.create
  .use(adminGuard())
  .use(agentModelGuard())
  .handler(async (opts) =>
    getAgentRuntime(opts.input.kind).createSession(callerOf(opts), opts.input)
  );

export const getAgentSessionRoute = contractOS.agent.sessions.get
  .use(adminGuard())
  .use(agentSessionGuard())
  .handler(async (opts) => {
    const { caller, runtime } = opts.context.agent;
    const detail = await runtime.getSession(caller, opts.input);
    if (!detail) throw opts.errors.NOT_FOUND();
    return detail;
  });

export const deleteAgentSessionRoute = contractOS.agent.sessions.delete
  .use(adminGuard())
  .use(agentSessionGuard())
  .handler(async (opts) => {
    const { caller, runtime } = opts.context.agent;
    const deleted = await runtime.deleteSession(caller, opts.input);
    if (!deleted) throw opts.errors.NOT_FOUND();
    return { sessionId: opts.input.sessionId };
  });

export const updateAgentSessionSettingsRoute = contractOS.agent.sessions[
  "settings:update"
]
  .use(adminGuard())
  .use(agentSessionGuard())
  .handler(async (opts) => {
    const { caller, runtime } = opts.context.agent;
    const detail = await runtime.updateSettings(caller, opts.input);
    if (!detail) throw opts.errors.NOT_FOUND();
    return detail;
  });

// ============================================
// Turns
// ============================================

/**
 * The handler returns the runtime's async generator directly — oRPC serialises it as an event
 * stream, so nothing is buffered and the first token reaches the client as soon as it exists.
 */
export const promptAgentRoute = contractOS.agent.sessions.prompt
  .use(adminGuard())
  .use(agentSessionGuard())
  .handler(async (opts) => {
    const { caller, runtime } = opts.context.agent;
    return await runtime.prompt(caller, opts.input);
  });

export const streamAgentRoute = contractOS.agent.sessions.stream
  .use(adminGuard())
  .use(agentSessionGuard())
  .handler(async (opts) => {
    const { caller, runtime } = opts.context.agent;
    return runtime.stream(caller, opts.input);
  });

export const chatAgentRoute = contractOS.agent.sessions.chat
  .use(adminGuard())
  .use(agentSessionGuard())
  .handler(async (opts) => {
    const { caller, runtime } = opts.context.agent;

    const cursor =
      opts.input.action.type === "prompt"
        ? await runtime.prompt(caller, {
            sessionId: opts.input.sessionId,
            text: opts.input.action.text,
          })
        : await runtime.approve(caller, {
            sessionId: opts.input.sessionId,
            toolCallId: opts.input.action.toolCallId,
            approved: opts.input.action.approved,
            comment: opts.input.action.comment,
          });
    if (!cursor) throw opts.errors.NOT_FOUND();

    const events = runtime.stream(caller, {
      sessionId: opts.input.sessionId,
      runId: cursor.runId,
      startIndex: cursor.startIndex,
      deltas: true,
    });
    return toTanStackAgentEventStream(events, {
      threadId: opts.input.threadId,
      runId: opts.input.runId,
    });
  });

export const abortAgentRoute = contractOS.agent.sessions.abort
  .use(adminGuard())
  .use(agentSessionGuard())
  .handler(async (opts) => {
    const { caller, runtime } = opts.context.agent;
    return { aborted: await runtime.abort(caller, opts.input) };
  });

export const steerAgentRoute = contractOS.agent.sessions.steer
  .use(adminGuard())
  .use(agentSessionGuard())
  .handler(async (opts) => {
    const { caller, runtime } = opts.context.agent;
    return { queued: await runtime.steer(caller, opts.input) };
  });

export const approveAgentToolRoute = contractOS.agent.sessions.approve
  .use(adminGuard())
  .use(agentSessionGuard())
  .handler(async (opts) => {
    const { caller, runtime } = opts.context.agent;
    const cursor = await runtime.approve(caller, opts.input);
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
  .use(adminGuard())
  .use(agentSessionGuard())
  .handler(async (opts) => {
    const { caller, runtime } = opts.context.agent;
    const result = await runtime.compact(caller, opts.input);
    if (!result) throw opts.errors.NOT_FOUND();
    return result;
  });

export const navigateAgentSessionRoute = contractOS.agent.sessions.navigate
  .use(adminGuard())
  .use(agentSessionGuard())
  .handler(async (opts) => {
    const { caller, runtime } = opts.context.agent;
    const result = await runtime.navigate(caller, opts.input);
    if (!result) throw opts.errors.NOT_FOUND();
    return result;
  });

export const getAgentDraftRoute = contractOS.agent.sessions.draft
  .use(adminGuard())
  .use(agentSessionGuard())
  .handler(async (opts) => {
    const { caller, runtime } = opts.context.agent;
    const draft = await runtime.getDraft?.(caller, opts.input);
    if (!draft) throw opts.errors.NOT_FOUND();
    return draft;
  });

// ============================================
// Capabilities
// ============================================

export const listAgentModelsRoute = contractOS.agent.models.list
  .use(adminGuard())
  .handler(async (opts) =>
    getAgentRuntime(opts.input.kind).listModels(callerOf(opts))
  );

export const listAgentCapabilitiesRoute = contractOS.agent.capabilities.list
  .use(adminGuard())
  .handler(async (opts) => getAgentRuntime(opts.input.kind).listCapabilities());
