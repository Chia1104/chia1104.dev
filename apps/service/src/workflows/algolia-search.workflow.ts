import { fetch } from "workflow";
import * as z from "zod";

import { getAlgoliaClient } from "@chia/api/algolia";

const deleteRequestSchema = z.object({
  objectIDs: z.array(z.string().or(z.number())),
});

export const deleteFeedFromAlgoliaWorkflow = async (
  request: z.input<typeof deleteRequestSchema>
) => {
  "use workflow";
  const { objectIDs } = deleteRequestSchema.parse(request);

  globalThis.fetch = fetch as unknown as typeof globalThis.fetch;

  const indexName = process.env.ALGOLIA_FEEDS_INDEX_NAME;
  if (!indexName) {
    throw new Error("ALGOLIA_FEEDS_INDEX_NAME is not set");
  }

  await Promise.all(
    objectIDs.map(async (objectID) => {
      await getAlgoliaClient().deleteObject({
        indexName,
        objectID: objectID.toString(),
      });
    })
  );

  return {
    success: true,
  };
};
