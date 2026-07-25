import type { AppErrorIssue } from "@chia/service-kit/errors";
import { errorGenerator } from "@chia/utils/server";

interface ORPCErrorBody {
  code?: unknown;
  status?: unknown;
  message?: unknown;
  data?: {
    /** Issues from `AppError`, via `toORPCError`. */
    errors?: AppErrorIssue[];
    /** Issues from oRPC's own input/output validation. */
    issues?: {
      path?: readonly (string | number)[];
      message?: string;
    }[];
  };
}

const isORPCErrorBody = (body: unknown): body is ORPCErrorBody =>
  !!body &&
  typeof body === "object" &&
  "code" in body &&
  "status" in body &&
  typeof (body as { status: unknown }).status === "number";

/**
 * Rewrites an oRPC error body into the `errorGenerator` shape.
 *
 * Only the REST surface gets this treatment: `libs/service/error.ts` in the frontends
 * (and any external consumer) parses `{ code, status, errors }`, whereas the oRPC client
 * on `/rpc` requires oRPC's own `{ defined, code, status, message, data }` and must be
 * left untouched.
 */
export const toLegacyErrorBody = (body: unknown, status: number): unknown => {
  if (!isORPCErrorBody(body)) {
    return body;
  }

  const issues: AppErrorIssue[] | undefined =
    body.data?.errors ??
    body.data?.issues?.map((issue) => ({
      field: (issue.path ?? []).map((segment) => String(segment)).join("."),
      message: issue.message ?? "invalid",
    }));

  return errorGenerator(status, issues);
};
