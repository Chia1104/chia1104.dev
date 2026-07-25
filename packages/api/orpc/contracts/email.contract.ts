import { oc } from "@orpc/contract";
import * as z from "zod";

/**
 * `path` keeps the URL the Hono route served, so the migration is invisible to callers
 * that still speak REST.
 */
export const sendContactEmailContract = oc
  .route({ method: "POST", path: "/email/send" })
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
       * Part of the input rather than a header so callers can use the plain
       * `orpc.email.send.mutationOptions()` without threading a per-call client context.
       */
      captchaToken: z.string().min(1),
    })
  )
  // The Hono route answered `c.json(null)`; kept as-is so REST callers see no change.
  .output(z.null());
