import { getAgentRuntime } from "../agent-runtime";
import type { AgentRuntimeCaller } from "../agent-runtime";
import { adminGuard } from "../guards/admin.guard";
import { contractOS } from "../utils";

/**
 * Agent routes.
 *
 * Thin by design: every handler resolves the registered runtime and forwards. The runtime lives in
 * the host app because it owns process-scoped state (live runs, provider credentials) — see
 * `../agent-runtime.ts`.
 *
 * `adminGuard()` pins to the configured admin id, so a logged-in non-admin cannot reach these even
 * with a valid session. That matters more here than on the read routes: these tools can write to
 * and publish the blog.
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
  .handler(async (opts) =>
    getAgentRuntime().listSessions(callerOf(opts), opts.input)
  );

export const createAgentSessionRoute = contractOS.agent.sessions.create
  .use(adminGuard())
  .handler(async (opts) =>
    getAgentRuntime().createSession(callerOf(opts), opts.input)
  );

export const getAgentSessionRoute = contractOS.agent.sessions.get
  .use(adminGuard())
  .handler(async (opts) => {
    const detail = await getAgentRuntime().getSession(
      callerOf(opts),
      opts.input
    );
    if (!detail) throw opts.errors.NOT_FOUND();
    return detail;
  });

export const deleteAgentSessionRoute = contractOS.agent.sessions.delete
  .use(adminGuard())
  .handler(async (opts) => {
    const deleted = await getAgentRuntime().deleteSession(
      callerOf(opts),
      opts.input
    );
    if (!deleted) throw opts.errors.NOT_FOUND();
    return { sessionId: opts.input.sessionId };
  });

export const updateAgentSessionSettingsRoute = contractOS.agent.sessions[
  "settings:update"
]
  .use(adminGuard())
  .handler(async (opts) => {
    const detail = await getAgentRuntime().updateSettings(
      callerOf(opts),
      opts.input
    );
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
  .handler((opts) => getAgentRuntime().prompt(callerOf(opts), opts.input));

export const streamAgentRoute = contractOS.agent.sessions.stream
  .use(adminGuard())
  .handler((opts) => getAgentRuntime().stream(callerOf(opts), opts.input));

export const abortAgentRoute = contractOS.agent.sessions.abort
  .use(adminGuard())
  .handler(async (opts) => ({
    aborted: await getAgentRuntime().abort(callerOf(opts), opts.input),
  }));

export const steerAgentRoute = contractOS.agent.sessions.steer
  .use(adminGuard())
  .handler(async (opts) => ({
    queued: await getAgentRuntime().steer(callerOf(opts), opts.input),
  }));

export const approveAgentToolRoute = contractOS.agent.sessions.approve
  .use(adminGuard())
  .handler(async (opts) => {
    const ok = await getAgentRuntime().approve(callerOf(opts), opts.input);
    if (!ok) throw opts.errors.NOT_FOUND();
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
  .handler(async (opts) => {
    const result = await getAgentRuntime().compact(callerOf(opts), opts.input);
    if (!result) throw opts.errors.NOT_FOUND();
    return result;
  });

export const navigateAgentSessionRoute = contractOS.agent.sessions.navigate
  .use(adminGuard())
  .handler(async (opts) => {
    const result = await getAgentRuntime().navigate(callerOf(opts), opts.input);
    if (!result) throw opts.errors.NOT_FOUND();
    return result;
  });

export const getAgentDraftRoute = contractOS.agent.sessions.draft
  .use(adminGuard())
  .handler(async (opts) => {
    const draft = await getAgentRuntime().getDraft(callerOf(opts), opts.input);
    if (!draft) throw opts.errors.NOT_FOUND();
    return draft;
  });

// ============================================
// Capabilities
// ============================================

export const listAgentModelsRoute = contractOS.agent.models.list
  .use(adminGuard())
  .handler(async () => getAgentRuntime().listModels());

export const listAgentCapabilitiesRoute = contractOS.agent.capabilities.list
  .use(adminGuard())
  .handler(async () => getAgentRuntime().listCapabilities());
