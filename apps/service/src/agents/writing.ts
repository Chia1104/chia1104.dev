import { createWritingAgentKind } from "@chia/agent-host/writing";
import { createContentReadPort } from "@chia/api/agents/content-read.port";

export const writingAgentKind = createWritingAgentKind({
  getPostForSeed: ({ db, adminId, feedId }) =>
    createContentReadPort({
      db,
      authorId: adminId,
      visibility: "author",
    }).getPost({ feedId }),
});
