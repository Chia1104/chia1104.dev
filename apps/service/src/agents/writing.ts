import { createWritingAgentKind } from "@chia/agent-host/writing";

/** No execution host; this process serves the session API and never runs a turn. */
export const writingAgentKind = createWritingAgentKind();
