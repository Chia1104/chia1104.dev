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
 * Reindexes every resource, one at a time.
 *
 * Flat and **serial** rather than one run per resource: `embedPendingChunksStep` sends 32
 * chunks per provider call, so running N resources at once hits the embedding rate limit
 * together — the retries then make it slower than the sequence, with an unpredictable cost
 * peak. A run per resource would also turn progress into an aggregate of N runs.
 *
 * `indexResource` is a plain composition of steps, not a workflow, so iterating it here
 * produces no nested runs.
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
      // changes and the bill is bounded by the current backlog
      if (onlyMissing) {
        await embedPendingChunksStep(target);
      } else {
        await indexResource(target);
      }
    } catch (error) {
      // one resource that exhausted its retries must not strand the rest of the corpus
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
