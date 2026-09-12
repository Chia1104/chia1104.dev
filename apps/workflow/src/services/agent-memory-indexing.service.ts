import { AGENT_MEMORY_SOURCE_TYPE } from "@chia/api/services/rag/registry";
import type { MemoryHooks } from "@chia/api/services/shared/context";

import { workflowControl } from "./workflow-control";

/**
 * Fire-and-forget index run per write. The run reads the row itself, so a removed or archived
 * memory clears its chunks through the adapter's "no content" path.
 */
export const memoryHooks: MemoryHooks = {
  async onMemoryChanged(memoryId) {
    await workflowControl.startResourceIndex({
      sourceType: AGENT_MEMORY_SOURCE_TYPE,
      sourceId: memoryId,
    });
  },
};
