import { createWritingAgentKind } from "@chia/agent-host/writing";
import { openFeedDraftService } from "@chia/api/feeds/draft";
import { listOpenFeedDrafts } from "@chia/db/repos/drafts";
import { FEED_DRAFT_AUTHOR } from "@chia/db/schema";

export const writingAgentKind = createWritingAgentKind({
  openDraft: ({ db, adminId, sessionId, feedId }) =>
    openFeedDraftService(db, {
      adminId,
      feedId,
      author: FEED_DRAFT_AUTHOR.Agent,
      sessionId,
    }),
  listDrafts: ({ db, adminId }) => listOpenFeedDrafts(db, adminId),
});
