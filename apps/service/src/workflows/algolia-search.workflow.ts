import { fetch } from "workflow";
import * as z from "zod";

import { client } from "@chia/api/algolia";

import { env } from "../env";

const getIndexName = () =>
  process.env.ALGOLIA_FEEDS_INDEX_NAME ?? env.ALGOLIA_FEEDS_INDEX_NAME;

const deleteRequestSchema = z.object({
  objectIDs: z.array(z.string().or(z.number())),
});

export const deleteFeedFromAlgoliaWorkflow = async (
  request: z.input<typeof deleteRequestSchema>
) => {
  "use workflow";
  const { objectIDs } = deleteRequestSchema.parse(request);

  globalThis.fetch = fetch as unknown as typeof globalThis.fetch;

  await Promise.all(
    objectIDs.map(async (objectID) => {
      await client.deleteObject({
        indexName: getIndexName(),
        objectID: objectID.toString(),
      });
    })
  );

  return {
    success: true,
  };
};
