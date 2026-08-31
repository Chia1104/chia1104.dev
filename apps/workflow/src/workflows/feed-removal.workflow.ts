import "zod/compile";
import * as z from "zod";

import { FEED_TRANSLATION_SOURCE_TYPE } from "@chia/api/resources/registry";

import { clearResourceChunksStep } from "../steps/resource-index.step";

const requestSchema = z.object({
  translationIDs: z.array(z.number()),
});

/**
 * Drops a feed's translations from the index after a soft delete.
 *
 * A hard delete cascades from `feed_translation`; a soft delete leaves the rows,
 * so without this the chunks stay searchable. Runs as a workflow so a failure
 * retries rather than silently leaving deleted content findable.
 */
export const removeFeedFromSearchIndexWorkflow = async (
  request: z.input<typeof requestSchema>
) => {
  "use workflow";

  const { translationIDs } = requestSchema.parse(request);

  const results = await Promise.all(
    translationIDs.map(async (translationID) => {
      const { deletedCount } = await clearResourceChunksStep({
        sourceType: FEED_TRANSLATION_SOURCE_TYPE,
        sourceId: translationID,
      });
      return { translationID, deletedCount };
    })
  );

  return { success: true as const, results };
};
