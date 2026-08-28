import { createContentReadPort } from "@chia/agent-host/content-read.port";
import { createWritingAgentKind } from "@chia/agent-host/writing";
import { getAdminId } from "@chia/utils/config";

import { createAgentContentPort } from "../services/agent-content.port";
import { createAgentMemoryPort } from "../services/agent-memory.port";
import { createAgentWebPort } from "../services/agent-web.port";
import { workflowControl } from "../services/workflow-control";

export const writingAgentKind = createWritingAgentKind({
  getPostForSeed: ({ db, adminId, feedId }) =>
    createContentReadPort({
      db,
      authorId: adminId,
      visibility: "author",
    }).getPost({ feedId }),
  execution: {
    adminId: () => getAdminId(),
    createContentPort: createAgentContentPort,
    createMemoryPort: createAgentMemoryPort,
    createWebPort: createAgentWebPort,
    startMemoryConsolidation: (sessionId) =>
      workflowControl.startMemoryConsolidation(sessionId),
  },
});
