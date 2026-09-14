import { captureException } from "@sentry/node-core/light";

import { logger } from "./logger";
import type { LogFields } from "./logger";

/**
 * Logs a failure of this process once and sends it to Sentry. Call it at the boundary that
 * handles the failure, and only for what the caller did not cause.
 */
export const reportError = (
  cause: unknown,
  message: string,
  context?: LogFields
) => {
  logger.error({ ...context, err: cause }, message);
  captureException(cause, { extra: context });
};
