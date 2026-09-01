import "zod/compile";
import { getWorkflowMetadata, RetryableError } from "workflow";

import {
  AGENT_MEMORY_SOURCE_TYPE,
  FEED_TRANSLATION_SOURCE_TYPE,
} from "@chia/api/resources/registry";
import { connectDatabase } from "@chia/db/client";
import { listAgentMemoryIds } from "@chia/db/repos/agent/memory";
import { listFeedTranslationIds } from "@chia/db/repos/feeds";
import {
  finalizeResourceIndexRun,
  getResourceIndexRunByExternalId,
  recordResourceIndexRunProgress,
} from "@chia/db/repos/resources/index-run";
import { RESOURCE_INDEX_RUN_STATUS } from "@chia/db/schema";
import type { ResourceIndexRunProgress } from "@chia/db/schema";

import type { ResourceIndexRequest } from "./resource-index.step";

/**
 * Kept out of `resource-index.step.ts`: that file is also on the feed-event path, which has
 * no `resource_index_run` row.
 */

/**
 * Every registered type must enumerate itself here. A type left out survives the index
 * version bump until `pruneEmbeddings`, then search degrades to lexical-only with no error.
 */
export const listReindexTargetsStep = async (): Promise<
  ResourceIndexRequest[]
> => {
  "use step";

  const db = await connectDatabase(undefined, { withCache: false });
  const [translationIds, memoryIds] = await Promise.all([
    listFeedTranslationIds(db, {}),
    listAgentMemoryIds(db),
  ]);

  return [
    ...translationIds.map((sourceId) => ({
      sourceType: FEED_TRANSLATION_SOURCE_TYPE,
      sourceId,
    })),
    ...memoryIds.map((sourceId) => ({
      sourceType: AGENT_MEMORY_SOURCE_TYPE,
      sourceId,
    })),
  ];
};

/**
 * Keyed on the runtime run id. Retries on a miss: the trigger claims the row after `start()`,
 * so the first attempt can arrive before that insert commits. A run that lost the claim race
 * never resolves here, so it dies at this step instead of embedding the corpus twice.
 */
export const resolveReindexRunStep = async (): Promise<number> => {
  "use step";

  const db = await connectDatabase(undefined, { withCache: false });
  const { workflowRunId } = getWorkflowMetadata();

  const row = await getResourceIndexRunByExternalId(db, {
    externalRunId: workflowRunId,
  });
  if (!row) {
    throw new RetryableError(
      `No resource index run recorded for workflow run ${workflowRunId}`,
      { retryAfter: 1_000 }
    );
  }

  return row.id;
};

export const recordReindexProgressStep = async (request: {
  recordId: number;
  progress: ResourceIndexRunProgress;
}): Promise<void> => {
  "use step";

  const db = await connectDatabase(undefined, { withCache: false });
  await recordResourceIndexRunProgress(db, {
    id: request.recordId,
    progress: request.progress,
  });
};

/**
 * Releases the target the active partial unique index holds. Terminal status is derived here:
 * exhausted retries leave the run `failed` with ids in `result`, never still-running.
 */
export const finalizeReindexRunStep = async (request: {
  recordId: number;
  result: { total: number; done: number; failed: number[] };
}): Promise<void> => {
  "use step";

  const db = await connectDatabase(undefined, { withCache: false });
  const { failed, total } = request.result;

  await finalizeResourceIndexRun(db, {
    id: request.recordId,
    status:
      failed.length === 0
        ? RESOURCE_INDEX_RUN_STATUS.Completed
        : RESOURCE_INDEX_RUN_STATUS.Failed,
    result: request.result,
    error:
      failed.length === 0
        ? null
        : `${failed.length} of ${total} resources failed`,
  });
};
