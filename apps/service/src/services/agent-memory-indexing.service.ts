import { AGENT_MEMORY_SOURCE_TYPE } from "@chia/services/rag/resource-types";
import type { MemoryHooks } from "@chia/services/shared/context";

import { workflowControl } from "../repos/workflow-control.repo";

export const memoryHooks: MemoryHooks = {
  async onMemoryChanged(memoryId) {
    await workflowControl.startResourceIndex({
      sourceType: AGENT_MEMORY_SOURCE_TYPE,
      sourceId: memoryId,
    });
  },
};
