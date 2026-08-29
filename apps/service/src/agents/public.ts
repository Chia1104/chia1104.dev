import { createPublicAgentKind } from "@chia/agent-host/public";

/** Bound without an execution host: this process serves the session API, it never runs a turn. */
export const publicAgentKind = createPublicAgentKind();
