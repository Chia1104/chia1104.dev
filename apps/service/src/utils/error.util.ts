import type { z } from "zod";

import { fromZodError, toErrorResponse } from "@chia/service-kit/errors";

/**
 * Same error shape as `AppError` on oRPC.
 *
 * @TODO Handle `invalid_union` by flattening the union's member issues.
 */
export const errorResponse = (
  zodError: z.core.$ZodError<unknown>,
  status = 400
) =>
  toErrorResponse(
    fromZodError(
      zodError,
      status === 422 ? "UNPROCESSABLE_CONTENT" : "BAD_REQUEST"
    )
  );
