import type { ErrorResponse } from "../request";

export const getClientIP = (request: Request): string => {
  return (
    request.headers.get("CF-Connecting-IP") ??
    request.headers.get("X-Forwarded-For")?.split(",")[0] ??
    request.headers.get("X-Real-IP") ??
    "anonymous"
  );
};

export const HTTPErrorConfig = {
  400: "Bad Request",
  401: "Unauthorized",
  403: "Forbidden",
  404: "Not Found",
  405: "Method Not Allowed",
  408: "Request Timeout",
  429: "Too Many Requests",
  500: "Internal Server Error",
  501: "Not Implemented",
  503: "Service Unavailable",
} as const;

export function errorGenerator(
  statusCode: number,
  errors?: ErrorResponse["errors"]
): ErrorResponse {
  if (!(statusCode in HTTPErrorConfig)) {
    return {
      code: "Unknown",
      status: statusCode,
      errors,
    };
  }
  return {
    code:
      HTTPErrorConfig[statusCode as keyof typeof HTTPErrorConfig] ?? "Unknown",
    status: statusCode,
    errors,
  };
}
