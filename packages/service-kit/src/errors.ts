import type { JsonObject } from "@chia/utils/json";
import type { ErrorResponse } from "@chia/utils/request";
import { errorGenerator } from "@chia/utils/server";

/** oRPC common error codes, plus `QUOTA_EXCEEDED`. */
export const AppErrorCode = {
  BadRequest: "BAD_REQUEST",
  Unauthorized: "UNAUTHORIZED",
  /** Not an oRPC common code; contracts must declare its status. */
  QuotaExceeded: "QUOTA_EXCEEDED",
  Forbidden: "FORBIDDEN",
  NotFound: "NOT_FOUND",
  Timeout: "TIMEOUT",
  Conflict: "CONFLICT",
  PayloadTooLarge: "PAYLOAD_TOO_LARGE",
  UnprocessableContent: "UNPROCESSABLE_CONTENT",
  TooManyRequests: "TOO_MANY_REQUESTS",
  InternalServerError: "INTERNAL_SERVER_ERROR",
  NotImplemented: "NOT_IMPLEMENTED",
  ServiceUnavailable: "SERVICE_UNAVAILABLE",
} as const;

export type AppErrorCode = (typeof AppErrorCode)[keyof typeof AppErrorCode];

export const APP_ERROR_STATUS = {
  [AppErrorCode.BadRequest]: 400,
  [AppErrorCode.Unauthorized]: 401,
  [AppErrorCode.QuotaExceeded]: 402,
  [AppErrorCode.Forbidden]: 403,
  [AppErrorCode.NotFound]: 404,
  [AppErrorCode.Timeout]: 408,
  [AppErrorCode.Conflict]: 409,
  [AppErrorCode.PayloadTooLarge]: 413,
  [AppErrorCode.UnprocessableContent]: 422,
  [AppErrorCode.TooManyRequests]: 429,
  [AppErrorCode.InternalServerError]: 500,
  [AppErrorCode.NotImplemented]: 501,
  [AppErrorCode.ServiceUnavailable]: 503,
} as const satisfies Record<AppErrorCode, number>;

export type AppErrorStatus = (typeof APP_ERROR_STATUS)[AppErrorCode];

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
  readonly status: AppErrorStatus;
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

export const appErrorCodeFromStatus = (status: number): AppErrorCode =>
  Object.values(AppErrorCode).find(
    (code) => APP_ERROR_STATUS[code] === status
  ) ?? AppErrorCode.InternalServerError;

interface ZodLikeError {
  issues?: {
    path: readonly (string | number | symbol)[];
    message: string;
  }[];
}

export const fromZodError = (
  error: ZodLikeError,
  code: AppErrorCode = AppErrorCode.BadRequest
): AppError =>
  new AppError(code, {
    issues: error.issues?.map((issue) => ({
      field: issue.path.map((segment) => String(segment)).join("."),
      message: issue.message,
    })),
  });
