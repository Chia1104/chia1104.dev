import { createWritingAgentKind } from "@chia/agent-host/writing";
import { openFeedDraftService } from "@chia/api/feeds/draft";
import { listOpenFeedDrafts } from "@chia/db/repos/drafts";
import { FEED_DRAFT_AUTHOR } from "@chia/db/schema";
import { getAdminId } from "@chia/utils/config";

import { createAgentContentPort } from "../services/agent-content.port";
import { createAgentMemoryPort } from "../services/agent-memory.port";
import { createAgentWebPort } from "../services/agent-web.port";
import { workflowControl } from "../services/workflow-control";

export const writingAgentKind = createWritingAgentKind({
  openDraft: ({ db, adminId, sessionId, feedId }) =>
    openFeedDraftService(db, {
      adminId,
      feedId,
      author: FEED_DRAFT_AUTHOR.Agent,
      sessionId,
    }),
  listDrafts: ({ db, adminId }) => listOpenFeedDrafts(db, adminId),
  execution: {
    adminId: () => getAdminId(),
    createContentPort: createAgentContentPort,
    createMemoryPort: createAgentMemoryPort,
    createWebPort: createAgentWebPort,
    startMemoryConsolidation: (sessionId) =>
      workflowControl.startMemoryConsolidation(sessionId),
  },
});
