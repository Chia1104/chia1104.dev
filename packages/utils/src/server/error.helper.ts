import { errorConfig } from "./network.config";
import type { ErrorResponse } from "../request/request.utill";

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
