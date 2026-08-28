import { createContentReadPort } from "@chia/agent-host/content-read.port";
import { createWritingAgentKind } from "@chia/agent-host/writing";

export const writingAgentKind = createWritingAgentKind({
  getPostForSeed: ({ db, adminId, feedId }) =>
    createContentReadPort({
      db,
      authorId: adminId,
      visibility: "author",
    }).getPost({ feedId }),
});
