import { fetch } from "workflow";
import * as z from "zod";

import { client } from "@chia/api/algolia";
import { Locale } from "@chia/db/types";

import { env } from "../env";

export const requestSchema = z.object({
  feedID: z.string().or(z.number()),
  objectID: z.string().or(z.number()),
  locale: z.enum(Locale).optional().default(Locale.zhTW),
  title: z.string(),
  content: z.string(),
  enabled: z.boolean().optional().default(true),
});

type Request = z.input<typeof requestSchema>;

export const saveFeedToAlgoliaWorkflow = async (request: Request) => {
  "use workflow";
  const parsedRequest = requestSchema.parse(request);

  globalThis.fetch = fetch as unknown as typeof globalThis.fetch;

  await client.saveObject({
    indexName: env.FEEDS_INDEX_NAME,
    body: {
      objectID: parsedRequest.objectID,
      feedID: parsedRequest.feedID,
      locale: parsedRequest.locale,
      title: parsedRequest.title,
      content: parsedRequest.content,
    },
  });

  return {
    success: true,
  };
};
