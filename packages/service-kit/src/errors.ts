import type { JsonObject } from "@chia/utils/json";
import type { ErrorResponse } from "@chia/utils/request";
import { errorGenerator } from "@chia/utils/server";

/** Status codes matching oRPC common error codes. */
export const APP_ERROR_STATUS = {
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  /** Not an oRPC common code; contracts must declare its status. */
  QUOTA_EXCEEDED: 402,
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
  /** Structured detail a client acts on; travels beside `issues`. */
  data?: JsonObject;
  cause?: unknown;
}

/** Domain error; adapters convert it to the transport's wire shape. */
export class AppError extends Error {
  readonly code: AppErrorCode;
  readonly status: number;
  readonly issues?: AppErrorIssue[];
  readonly headers?: Record<string, string>;
  readonly data?: JsonObject;

  constructor(code: AppErrorCode, options?: AppErrorOptions) {
    super(options?.message ?? code, { cause: options?.cause });
    this.name = "AppError";
    this.code = code;
    this.status = APP_ERROR_STATUS[code];
    this.issues = options?.issues;
    this.headers = options?.headers;
    this.data = options?.data;
  }
}

export const isAppError = (cause: unknown): cause is AppError =>
  cause instanceof AppError;

export const toErrorResponse = (error: AppError): ErrorResponse =>
  errorGenerator(error.status, error.issues);

export const appErrorCodeFromStatus = (status: number): AppErrorCode => {
  const match = Object.entries(APP_ERROR_STATUS).find(
    ([, value]) => value === status
  );
  return (
    /* SAFETY: The producer contract guarantees this value satisfies AppErrorCode | undefined. */ (match?.[0] as
      | AppErrorCode
      | undefined) ?? "INTERNAL_SERVER_ERROR"
  );
};

interface ZodLikeError {
  issues?: {
    path: readonly (string | number | symbol)[];
    message: string;
  }[];
}

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
