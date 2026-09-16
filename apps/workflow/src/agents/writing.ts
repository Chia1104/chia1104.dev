import { createWritingAgentExecutor } from "@chia/agent-host/writing";
import { listOpenFeedDrafts } from "@chia/db/repos/drafts";
import { FEED_DRAFT_AUTHOR } from "@chia/db/schema";
import { openFeedDraftService } from "@chia/services/feeds/draft.service";
import { getAdminId } from "@chia/utils/config";

import { createAgentContentPort } from "../services/agent-content.port";
import { createAgentGitHubPort } from "../services/agent-github.port";
import { createAgentMemoryPort } from "../services/agent-memory.port";
import { createAgentWebPort } from "../services/agent-web.port";
import { workflowControl } from "../services/workflow-control";

export const writingAgentKind = createWritingAgentExecutor({
  openDraft: ({ db, adminId, sessionId, feedId }) =>
    openFeedDraftService(db, {
      adminId,
      feedId,
      author: FEED_DRAFT_AUTHOR.Agent,
      sessionId,
    }),
  listDrafts: ({ db, adminId }) => listOpenFeedDrafts(db, adminId),
  adminId: () => getAdminId(),
  createContentPort: createAgentContentPort,
  createMemoryPort: createAgentMemoryPort,
  createWebPort: createAgentWebPort,
  createGitHubPort: createAgentGitHubPort,
  startMemoryConsolidation: (request) =>
    workflowControl.startMemoryConsolidation(request),
  cancelWorkflowRun: (runId) => workflowControl.cancelRun(runId),
});
