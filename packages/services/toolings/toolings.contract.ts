import { oc, type } from "@orpc/contract";
import * as z from "zod";

import type { TweetResult } from "@chia/integrations/x";

export const linkPreviewSchema = z.object({
  title: z.string().nullish(),
  description: z.string().nullish(),
  favicon: z.string().nullish(),
  ogImage: z.string().nullish(),
});

export type LinkPreview = z.infer<typeof linkPreviewSchema>;

export const linkPreviewContract = oc
  .errors({
    BAD_REQUEST: {},
    TOO_MANY_REQUESTS: {},
    INTERNAL_SERVER_ERROR: {},
  })
  .input(z.strictObject({ href: z.url() }))
  .output(linkPreviewSchema);

/** X post ids are numeric snowflakes. */
export const tweetIdSchema = z.string().regex(/^\d{1,20}$/);

/** The post payload is X's shape, passed through unvalidated; `@chia/integrations/x` owns it. */
export const tweetContract = oc
  .errors({
    UNAUTHORIZED: {},
    FORBIDDEN: {},
    NOT_FOUND: {},
    TOO_MANY_REQUESTS: {},
    SERVICE_UNAVAILABLE: {},
  })
  .input(z.strictObject({ id: tweetIdSchema }))
  .output(type<TweetResult>());

export const toolingsContract = {
  "link-preview": linkPreviewContract,
  tweet: tweetContract,
};
