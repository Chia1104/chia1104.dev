import { createPublicAgentExecutor } from "@chia/agent-host/public";
import { createContentReadPort } from "@chia/services/agent/content-read.port";
import { createProfileReadPort } from "@chia/services/agent/profile-read.port";
import { getAdminId } from "@chia/utils/config";

/** Both ports see the configured author's published rows. `getAdminId()` is whose profile and posts these are, not who is asking. */
export const publicAgentKind = createPublicAgentExecutor({
  createContentPort: ({ db }) =>
    createContentReadPort({
      db,
      authorId: getAdminId(),
      visibility: "public",
    }),
  createProfilePort: ({ db }) =>
    createProfileReadPort({ db, authorId: getAdminId() }),
});
