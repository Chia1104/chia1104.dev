import { oc } from "@orpc/contract";
import * as z from "zod";

export const linkPreviewSchema = z.object({
  title: z.string().nullish(),
  description: z.string().nullish(),
  favicon: z.string().nullish(),
  ogImage: z.string().nullish(),
});

export type LinkPreview = z.infer<typeof linkPreviewSchema>;

/**
 * `path` keeps the URL the Hono route served, so the migration is invisible to callers
 * that still speak REST.
 */
export const linkPreviewContract = oc
  .route({ method: "POST", path: "/toolings/link-preview" })
  .errors({
    BAD_REQUEST: {},
    TOO_MANY_REQUESTS: {},
    INTERNAL_SERVER_ERROR: {},
  })
  .input(z.strictObject({ href: z.url() }))
  .output(linkPreviewSchema);
