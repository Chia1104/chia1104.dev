import { oc } from "@orpc/contract";
import * as z from "zod";

/**
 * Unauthenticated liveness lives on Hono (`GET /api/v1/health`) so it keeps answering
 * when db/kv are unavailable. This is the authenticated variant.
 */
export const protectedHealthContract = oc
  .errors({
    UNAUTHORIZED: {},
  })
  .output(
    z.object({
      status: z.string(),
    })
  );
