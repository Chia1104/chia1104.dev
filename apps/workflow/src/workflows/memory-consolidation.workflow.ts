import "zod/compile";
import * as z from "zod";

import { consolidateSessionMemoryStep } from "../steps/memory-consolidation.step";
import type { MemoryConsolidationResult } from "../steps/memory-consolidation.step";

export const memoryConsolidationRequestSchema = z.object({
  sessionId: z.string().min(1),
});

/**
 * Reflection over one writing session, started after a turn that committed a post or by
 * hand from the dashboard. One step; runs as a workflow so it survives the process that
 * started it and leaves a run the dashboard can look up.
 */
export const memoryConsolidationWorkflow = async (
  request: z.input<typeof memoryConsolidationRequestSchema>
): Promise<MemoryConsolidationResult> => {
  "use workflow";

  const { sessionId } = memoryConsolidationRequestSchema.parse(request);
  const result = await consolidateSessionMemoryStep({ sessionId });

  console.log("Memory consolidation finished", { sessionId, ...result });

  return result;
};
