import "zod/compile";
import { sleep } from "workflow";
import * as z from "zod";

import { consolidateSessionMemoryStep } from "../steps/memory-consolidation.step";
import type { MemoryConsolidationResult } from "../steps/memory-consolidation.step";

export const memoryConsolidationRequestSchema = z.object({
  sessionId: z.string().min(1),
  delayMs: z.number().int().nonnegative().optional(),
});

/**
 * One step, as a workflow so it survives the process that started it and leaves a run the
 * dashboard can look up. With `delayMs` it waits first: the host schedules one of these after
 * every turn and cancels it when the next turn arrives, so a session is read once it has gone
 * quiet. Runs in the workflow sandbox: no Node built-ins.
 */
export const memoryConsolidationWorkflow = async (
  request: z.input<typeof memoryConsolidationRequestSchema>
): Promise<MemoryConsolidationResult> => {
  "use workflow";

  const { sessionId, delayMs } =
    memoryConsolidationRequestSchema.parse(request);
  if (delayMs) await sleep(`${delayMs}ms`);

  const result = await consolidateSessionMemoryStep({ sessionId });

  console.log("Memory consolidation finished", { sessionId, ...result });

  return result;
};
