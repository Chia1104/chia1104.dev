import "zod/compile";
import * as z from "zod";

import { ResourceType } from "@chia/services/rag/resource-types";

import { clearResourceChunksStep } from "../steps/resource-index.step";
import { scheduleRemovalRevalidationStep } from "../steps/site-revalidation.step";

const requestSchema = z.object({
  translationIDs: z.array(z.number()),
});

/**
 * Soft delete leaves the rows, so chunks stay searchable without this; www also keeps serving
 * the page until it re-renders.
 * A workflow so a failure retries rather than leaving deleted content findable.
 */
export const removeFeedFromSearchIndexWorkflow = async (
  request: z.input<typeof requestSchema>
) => {
  "use workflow";

  const { translationIDs } = requestSchema.parse(request);

  const results = await Promise.all(
    translationIDs.map(async (translationID) => {
      const { deletedCount } = await clearResourceChunksStep({
        sourceType: ResourceType.FeedTranslation,
        sourceId: translationID,
      });
      return { translationID, deletedCount };
    })
  );

  await scheduleRemovalRevalidationStep();

  return { success: true as const, results };
};
