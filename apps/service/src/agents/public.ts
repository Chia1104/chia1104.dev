import { createPublicAgentKind } from "@chia/agent-host/public";

/** No execution host; this process serves the session API and never runs a turn. */
export const publicAgentKind = createPublicAgentKind();
