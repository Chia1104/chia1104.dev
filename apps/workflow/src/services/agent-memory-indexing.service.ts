import type { MemoryHooks } from "@chia/api/orpc/utils";
import { AGENT_MEMORY_SOURCE_TYPE } from "@chia/api/resources/registry";

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
