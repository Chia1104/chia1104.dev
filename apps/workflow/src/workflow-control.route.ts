import { timingSafeEqual } from "node:crypto";

import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";

import { reportError } from "@chia/observability/report";
import { isAppError } from "@chia/service-kit/errors";
import { workflowControlCommandSchema } from "@chia/workflow-control/contract";

import { env } from "./env";
import { executeLocalWorkflowCommand } from "./services/workflow-control";

const isAuthorized = (authorization: string | undefined): boolean => {
  if (!authorization || !env.INTERNAL_WORKFLOW_SERVICE_TOKEN) return false;
  const actual = Buffer.from(authorization);
  const expected = Buffer.from(`Bearer ${env.INTERNAL_WORKFLOW_SERVICE_TOKEN}`);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
};

const api = new Hono().post(
  "/",
  zValidator("json", workflowControlCommandSchema),
  async (c) => {
    if (!isAuthorized(c.req.header("authorization"))) {
      return c.json({ error: "Unauthorized." }, 401);
    }

    const command = c.req.valid("json");
    try {
      return c.json(await executeLocalWorkflowCommand(command));
    } catch (error) {
      if (!isAppError(error) || error.status >= 500) {
        reportError(error, "Workflow command failed", {
          requestId: c.get("requestId"),
          type: command.type,
        });
      }
      if (isAppError(error)) {
        return c.json({ error: error.message }, error.status);
      }
      return c.json({ error: "Workflow command failed." }, 503);
    }
  }
);

export default api;
