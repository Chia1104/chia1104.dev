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
    })
  )
  .output(
    z.object({
      url: z.string(),
    })
  );
