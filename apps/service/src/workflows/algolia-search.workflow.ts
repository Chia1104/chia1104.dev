import { fetch } from "workflow";
import * as z from "zod";

import { client } from "@chia/api/algolia";
import { Locale } from "@chia/db/types";

import { env } from "../env";
import type { AlgoliaFeedHit } from "../services/feeds.service";

export const requestSchema = z.object({
  feedID: z.string().or(z.number()),
  objectID: z.string().or(z.number()),
  type: z.enum(["post", "note"]),
  locale: z.enum(Locale).optional().default(Locale.zhTW),
  slug: z.string(),
  title: z.string(),
  content: z.string(),
  description: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  enabled: z.boolean().optional().default(true),
});

type Request = z.input<typeof requestSchema>;

const getIndexName = () =>
  process.env.ALGOLIA_FEEDS_INDEX_NAME ?? env.ALGOLIA_FEEDS_INDEX_NAME;

export const saveFeedToAlgoliaWorkflow = async (request: Request) => {
  "use workflow";
  const parsedRequest = requestSchema.parse(request);

  globalThis.fetch = fetch as unknown as typeof globalThis.fetch;

  const indexName = getIndexName();

  if (!parsedRequest.enabled) {
    await client.deleteObject({
      indexName,
      objectID: parsedRequest.objectID.toString(),
    });
    return {
      success: true,
    };
  }

  await client.saveObject({
    indexName,
    body: {
      version: "2026.07.13",
      objectID: parsedRequest.objectID,
      feedID: parsedRequest.feedID,
      type: parsedRequest.type,
      locale: parsedRequest.locale,
      slug: parsedRequest.slug,
      title: parsedRequest.title,
      description: parsedRequest.description,
      createdAt: parsedRequest.createdAt,
      updatedAt: parsedRequest.updatedAt,
      content: parsedRequest.content,
    } satisfies AlgoliaFeedHit,
  });

  return {
    success: true,
  };
};

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
