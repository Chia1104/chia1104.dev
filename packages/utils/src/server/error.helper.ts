import type { ErrorResponse } from "../request/request.utill";
import { errorConfig } from "./network.config";

export function errorGenerator(
  statusCode: number,
  errors?: ErrorResponse["errors"]
): ErrorResponse {
  if (!(statusCode in errorConfig)) {
    return {
      code: "Unknown",
      status: statusCode,
      errors,
    };
  }
  return {
    code: errorConfig[statusCode as keyof typeof errorConfig] ?? "Unknown",
    status: statusCode,
    errors,
  };
}

export class ParsedJSONError extends Error {
  constructor(public error: ErrorResponse) {
    super("Parsed JSON error");
  }
}
