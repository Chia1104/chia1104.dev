import type { DB } from "@chia/db";
import { getAgentSession } from "@chia/db/repos/agent";

import { getAgentRuntime, registeredAgentKinds } from "../agent-runtime";
import type { AgentRuntimeCaller } from "../agent-runtime";
import { adminGuard } from "../guards/admin.guard";
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
 */

const callerOf = (opts: {
  context: { adminId: string; session: { user: { id: string } } };
}): AgentRuntimeCaller => ({
  adminId: opts.context.adminId,
  userId: opts.context.session.user.id,
  context: opts.context as unknown as AgentRuntimeCaller["context"],
});

const sessionRuntimeOf = async (
  caller: AgentRuntimeCaller,
  sessionId: string,
  requestedKind?: string
) => {
  const row = await getAgentSession(caller.context.db as DB, sessionId);
  if (!row || row.deletedAt !== null || row.userId !== caller.userId)
    return null;
  if (requestedKind && requestedKind !== row.kind) return null;
  return getAgentRuntime(row.kind);
};

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

export const createAgentSessionRoute = contractOS.agent.sessions.create
  .use(adminGuard())
  .handler(async (opts) =>
    getAgentRuntime(opts.input.kind).createSession(callerOf(opts), opts.input)
  );

export const getAgentSessionRoute = contractOS.agent.sessions.get
  .use(adminGuard())
  .handler(async (opts) => {
    const caller = callerOf(opts);
    const runtime = await sessionRuntimeOf(
      caller,
      opts.input.sessionId,
      opts.input.kind
    );
    const detail = await runtime?.getSession(caller, opts.input);
    if (!detail) throw opts.errors.NOT_FOUND();
    return detail;
  });

export const deleteAgentSessionRoute = contractOS.agent.sessions.delete
  .use(adminGuard())
  .handler(async (opts) => {
    const caller = callerOf(opts);
    const runtime = await sessionRuntimeOf(
      caller,
      opts.input.sessionId,
      opts.input.kind
    );
    const deleted = await runtime?.deleteSession(caller, opts.input);
    if (!deleted) throw opts.errors.NOT_FOUND();
    return { sessionId: opts.input.sessionId };
  });

export const updateAgentSessionSettingsRoute = contractOS.agent.sessions[
  "settings:update"
]
  .use(adminGuard())
  .handler(async (opts) => {
    const caller = callerOf(opts);
    const runtime = await sessionRuntimeOf(
      caller,
      opts.input.sessionId,
      opts.input.kind
    );
    const detail = await runtime?.updateSettings(caller, opts.input);
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
  .handler(async (opts) => {
    const caller = callerOf(opts);
    const runtime = await sessionRuntimeOf(
      caller,
      opts.input.sessionId,
      opts.input.kind
    );
    if (!runtime) throw opts.errors.NOT_FOUND();
    return await runtime.prompt(caller, opts.input);
  });

export const streamAgentRoute = contractOS.agent.sessions.stream
  .use(adminGuard())
  .handler(async (opts) => {
    const caller = callerOf(opts);
    const runtime = await sessionRuntimeOf(
      caller,
      opts.input.sessionId,
      opts.input.kind
    );
    if (!runtime) throw opts.errors.NOT_FOUND();
    return runtime.stream(caller, opts.input);
  });

export const abortAgentRoute = contractOS.agent.sessions.abort
  .use(adminGuard())
  .handler(async (opts) => {
    const caller = callerOf(opts);
    const runtime = await sessionRuntimeOf(
      caller,
      opts.input.sessionId,
      opts.input.kind
    );
    if (!runtime) throw opts.errors.NOT_FOUND();
    return { aborted: await runtime.abort(caller, opts.input) };
  });

export const steerAgentRoute = contractOS.agent.sessions.steer
  .use(adminGuard())
  .handler(async (opts) => {
    const caller = callerOf(opts);
    const runtime = await sessionRuntimeOf(
      caller,
      opts.input.sessionId,
      opts.input.kind
    );
    if (!runtime) throw opts.errors.NOT_FOUND();
    return { queued: await runtime.steer(caller, opts.input) };
  });

export const approveAgentToolRoute = contractOS.agent.sessions.approve
  .use(adminGuard())
  .handler(async (opts) => {
    const caller = callerOf(opts);
    const runtime = await sessionRuntimeOf(
      caller,
      opts.input.sessionId,
      opts.input.kind
    );
    const ok = await runtime?.approve(caller, opts.input);
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
    const caller = callerOf(opts);
    const runtime = await sessionRuntimeOf(
      caller,
      opts.input.sessionId,
      opts.input.kind
    );
    const result = await runtime?.compact(caller, opts.input);
    if (!result) throw opts.errors.NOT_FOUND();
    return result;
  });

export const navigateAgentSessionRoute = contractOS.agent.sessions.navigate
  .use(adminGuard())
  .handler(async (opts) => {
    const caller = callerOf(opts);
    const runtime = await sessionRuntimeOf(
      caller,
      opts.input.sessionId,
      opts.input.kind
    );
    const result = await runtime?.navigate(caller, opts.input);
    if (!result) throw opts.errors.NOT_FOUND();
    return result;
  });

export const getAgentDraftRoute = contractOS.agent.sessions.draft
  .use(adminGuard())
  .handler(async (opts) => {
    const caller = callerOf(opts);
    const runtime = await sessionRuntimeOf(
      caller,
      opts.input.sessionId,
      opts.input.kind
    );
    const draft = await runtime?.getDraft?.(caller, opts.input);
    if (!draft) throw opts.errors.NOT_FOUND();
    return draft;
  });

// ============================================
// Capabilities
// ============================================

export const listAgentModelsRoute = contractOS.agent.models.list
  .use(adminGuard())
  .handler(async (opts) => getAgentRuntime(opts.input.kind).listModels());

export const listAgentCapabilitiesRoute = contractOS.agent.capabilities.list
  .use(adminGuard())
  .handler(async (opts) => getAgentRuntime(opts.input.kind).listCapabilities());
