import { createPublicAgentKind } from "@chia/agent-host/public";
import { createContentReadPort } from "@chia/api/agents/content-read.port";
import { getAdminId } from "@chia/utils/config";

/** Content port sees the configured author's published posts. `getAdminId()` is whose posts these are, not who is asking. */
export const publicAgentKind = createPublicAgentKind({
  execution: {
    createContentPort: ({ db }) =>
      createContentReadPort({
        db,
        authorId: getAdminId(),
        visibility: "public",
      }),
  },
});
