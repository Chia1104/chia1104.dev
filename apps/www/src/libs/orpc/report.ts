import { COMMON_ERROR_STATUS_MAP, ORPCError } from "@orpc/client";
import { captureException } from "@sentry/nextjs";

const errorStatus = new Map<string, number>(
  Object.entries(COMMON_ERROR_STATUS_MAP)
);

/**
 * Reports a service call that failed for a reason other than the request itself. A 4xx is the
 * answer to what was asked, most often a missing post, and is not one.
 */
export const reportServiceError = (cause: unknown) => {
  if (
    cause instanceof ORPCError &&
    (errorStatus.get(cause.code) ?? 500) < 500
  ) {
    return;
  }
  captureException(cause);
};

/**
 * Whether `service` answered that the resource does not exist. Only this is a 404: any other
 * failure rendered as one would be cached as one.
 */
export const isServiceNotFound = (cause: unknown): boolean =>
  cause instanceof ORPCError && cause.code === "NOT_FOUND";
