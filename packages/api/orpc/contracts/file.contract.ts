import { oc } from "@orpc/contract";
import * as z from "zod";

export const createSignedUrlForUploadContract = oc
  .errors({
    UNAUTHORIZED: {},
    FORBIDDEN: {},
    INTERNAL_SERVER_ERROR: {},
  })
  .input(
    z.object({
      key: z.string(),
      area: z.enum(["global", "feed"]),
      sha256Checksum: z.string(),
      type: z.enum([
        "image/jpeg",
        "image/png",
        "image/webp",
        "image/heic",
        "image/heif",
      ]),
      size: z.number(),
    })
  )
  .output(
    z.object({
      url: z.string(),
    })
  );
