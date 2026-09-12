import { AGENT_MEMORY_SOURCE_TYPE } from "@chia/api/services/rag/registry";
import type { MemoryHooks } from "@chia/api/services/shared/context";

import { workflowControl } from "../repos/workflow-control.repo";

export const memoryHooks: MemoryHooks = {
  async onMemoryChanged(memoryId) {
    await workflowControl.startResourceIndex({
      sourceType: AGENT_MEMORY_SOURCE_TYPE,
      sourceId: memoryId,
    });
  },
};
