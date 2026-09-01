import { oc } from "@orpc/contract";
import * as z from "zod";

export const sendContactEmailContract = oc
  .errors({
    BAD_REQUEST: {},
    TOO_MANY_REQUESTS: {},
    INTERNAL_SERVER_ERROR: {},
  })
  .input(
    z.strictObject({
      email: z.email(),
      title: z.string().min(4, "Title must be at least 4 characters long"),
      message: z.string().min(5, "Message must be at least 5 characters long"),
      /**
       * Part of the input rather than a header so callers can use
       * `orpc.email.send.mutationOptions()` without threading a per-call client context.
       */
      captchaToken: z.string().min(1),
    })
  )
  .output(z.null());
