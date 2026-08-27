import { start } from "workflow/api";

import type { MemoryHooks } from "@chia/api/orpc/utils";
import { AGENT_MEMORY_SOURCE_TYPE } from "@chia/api/resources/registry";

import { indexResourceWorkflow } from "../workflows/resource-index.workflow";

/**
 * The memory hooks this process supplies: a fire-and-forget index run per write, the same
 * shape as `feedHooks`. The run reads the row itself, so a removed or archived memory ends
 * up with its chunks cleared through the adapter's "no content" path — one hook, no
 * separate removal workflow.
 */
export const memoryHooks: MemoryHooks = {
  async onMemoryChanged(memoryId) {
    await start(indexResourceWorkflow, [
      { sourceType: AGENT_MEMORY_SOURCE_TYPE, sourceId: memoryId },
    ]);
  },
};
