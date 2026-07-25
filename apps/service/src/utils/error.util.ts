import type { z } from "zod";

import { fromZodError, toErrorResponse } from "@chia/service-kit/errors";

/**
 * Renders a Zod validation failure as an HTTP error body.
 *
 * Delegates to `fromZodError` + `toErrorResponse` so validation errors have the same
 * shape `AppError` produces everywhere else, including on the oRPC side.
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
