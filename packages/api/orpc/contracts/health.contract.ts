import { oc } from "@orpc/contract";
import * as z from "zod";

/**
 * Unauthenticated liveness lives on the Hono side (`GET /api/v1/health`) so it keeps
 * answering when db/kv are unavailable. This one is the authenticated variant.
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
