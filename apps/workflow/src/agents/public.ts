import { createPublicAgentKind } from "@chia/agent-host/public";
import { createContentReadPort } from "@chia/api/agents/content-read.port";
import { createProfileReadPort } from "@chia/api/agents/profile-read.port";
import { getAdminId } from "@chia/utils/config";

/** Both ports see the configured author's published rows. `getAdminId()` is whose profile and posts these are, not who is asking. */
export const publicAgentKind = createPublicAgentKind({
  execution: {
    createContentPort: ({ db }) =>
      createContentReadPort({
        db,
        authorId: getAdminId(),
        visibility: "public",
      }),
    createProfilePort: ({ db }) =>
      createProfileReadPort({ db, authorId: getAdminId() }),
  },
});
