import { oc } from "@orpc/contract";
import * as z from "zod";

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
