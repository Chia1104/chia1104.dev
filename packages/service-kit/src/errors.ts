import type { ErrorResponse } from "@chia/utils/request";
import { errorGenerator } from "@chia/utils/server";

/**
 * Error codes usable across transports. Names match oRPC's common error codes so a
 * policy failure maps onto `errors[code]()` without translation.
 */
export const APP_ERROR_STATUS = {
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  TIMEOUT: 408,
  CONFLICT: 409,
  PAYLOAD_TOO_LARGE: 413,
  UNPROCESSABLE_CONTENT: 422,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_SERVER_ERROR: 500,
  NOT_IMPLEMENTED: 501,
  SERVICE_UNAVAILABLE: 503,
} as const;

export type AppErrorCode = keyof typeof APP_ERROR_STATUS;

export interface AppErrorIssue {
  field: string;
  message: string;
  code?: string;
}

export interface AppErrorOptions {
  message?: string;
  issues?: AppErrorIssue[];
  /** Extra response headers, e.g. `Retry-After` on 429/503. */
  headers?: Record<string, string>;
  cause?: unknown;
}

/**
 * The one error type policies and handlers throw. Each transport adapter converts it
 * into its own wire representation, so a given failure produces the same body over
 * REST and RPC.
 */
export class AppError extends Error {
  readonly code: AppErrorCode;
  readonly status: number;
  readonly issues?: AppErrorIssue[];
  readonly headers?: Record<string, string>;

  constructor(code: AppErrorCode, options?: AppErrorOptions) {
    super(options?.message ?? code, { cause: options?.cause });
    this.name = "AppError";
    this.code = code;
    this.status = APP_ERROR_STATUS[code];
    this.issues = options?.issues;
    this.headers = options?.headers;
  }
}

export const isAppError = (error: unknown): error is AppError =>
  error instanceof AppError;

/**
 * Canonical HTTP body for an `AppError`. Delegates to `errorGenerator` so the shape
 * stays the one `libs/service/error.ts` in the frontends already parses.
 */
export const toErrorResponse = (error: AppError): ErrorResponse =>
  errorGenerator(error.status, error.issues);

/**
 * Maps HTTP status codes back onto an `AppErrorCode`, for wrapping errors thrown by
 * third-party clients (`ky`'s `HTTPError`, better-auth's `APIError`, …).
 */
export const appErrorCodeFromStatus = (status: number): AppErrorCode => {
  const match = Object.entries(APP_ERROR_STATUS).find(
    ([, value]) => value === status
  );
  return (match?.[0] as AppErrorCode | undefined) ?? "INTERNAL_SERVER_ERROR";
};

interface ZodLikeError {
  issues?: {
    path: readonly (string | number | symbol)[];
    message: string;
  }[];
}

/**
 * Converts a Zod error into an `AppError`, preserving the `field`/`message` pairs the
 * existing `errorResponse` helper produced.
 */
export const fromZodError = (
  error: ZodLikeError,
  code: AppErrorCode = "BAD_REQUEST"
): AppError =>
  new AppError(code, {
    issues: error.issues?.map((issue) => ({
      field: issue.path.map((segment) => String(segment)).join("."),
      message: issue.message,
    })),
  });
