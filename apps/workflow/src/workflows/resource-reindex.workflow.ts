import "zod/compile";
import * as z from "zod";

import {
  embedPendingChunksStep,
  indexResource,
} from "../steps/resource-index.step";
import {
  finalizeReindexRunStep,
  listReindexTargetsStep,
  recordReindexProgressStep,
  resolveReindexRunStep,
} from "../steps/resource-reindex.step";

export const resourceReindexRequestSchema = z.object({
  onlyMissing: z.boolean().optional().default(false),
});

type Request = z.input<typeof resourceReindexRequestSchema>;

export interface ResourceReindexResult {
  total: number;
  done: number;
  /** `source_id`s whose indexing threw; the run still finished. */
  failed: number[];
}

/**
 * `embedPendingChunksStep` sends 32 chunks per call, so N resources at once hit the
 * rate limit together. `indexResource` is a composition of steps, not a nested workflow.
 */
export const resourceReindexWorkflow = async (
  request: Request
): Promise<ResourceReindexResult> => {
  "use workflow";

  const { onlyMissing } = resourceReindexRequestSchema.parse(request);

  const recordId = await resolveReindexRunStep();
  const targets = await listReindexTargetsStep();
  const total = targets.length;

  const failed: number[] = [];
  let done = 0;

  for (const target of targets) {
    try {
      // `onlyMissing` tops up vectors without rewriting chunks, so no `content_hash`
      // changes and the bill is bounded by the current backlog.
      if (onlyMissing) {
        await embedPendingChunksStep(target);
      } else {
        await indexResource(target);
      }
    } catch (error) {
      // One resource that exhausted its retries must not strand the rest of the corpus.
      failed.push(target.sourceId);
      console.error("Resource reindex failed for one resource", {
        ...target,
        error: String(error),
      });
    }

    done += 1;
    await recordReindexProgressStep({
      recordId,
      progress: { done, total, failed },
    });
  }

  const result = { total, done, failed };
  await finalizeReindexRunStep({ recordId, result });

  if (failed.length > 0) {
    console.error("Resource reindex finished with failures", result);
  } else {
    console.log("Resource reindex finished", result);
  }

  return result;
};
