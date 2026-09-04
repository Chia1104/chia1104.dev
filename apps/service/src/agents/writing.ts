import { createWritingAgentKind } from "@chia/agent-host/writing";
import { openFeedDraftService } from "@chia/api/feeds/draft";
import { FEED_DRAFT_AUTHOR } from "@chia/db/schema";

export const writingAgentKind = createWritingAgentKind({
  openDraft: ({ db, adminId, sessionId, feedId, draftId }) =>
    openFeedDraftService(db, {
      adminId,
      feedId,
      draftId,
      author: FEED_DRAFT_AUTHOR.Agent,
      sessionId,
    }),
});
