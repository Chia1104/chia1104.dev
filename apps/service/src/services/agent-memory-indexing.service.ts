import type { MemoryHooks } from "@chia/api/orpc/utils";
import { AGENT_MEMORY_SOURCE_TYPE } from "@chia/api/resources/registry";

import { workflowControl } from "./workflow-control";

export const memoryHooks: MemoryHooks = {
  async onMemoryChanged(memoryId) {
    await workflowControl.startResourceIndex({
      sourceType: AGENT_MEMORY_SOURCE_TYPE,
      sourceId: memoryId,
    });
  },
};
