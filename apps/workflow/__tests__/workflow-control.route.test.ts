const { executeLocalWorkflowCommand, token } = vi.hoisted(() => ({
  executeLocalWorkflowCommand: vi.fn(async () => ({ type: "completed" })),
  token: "w".repeat(32),
}));

vi.mock("../src/env", () => ({
  env: {
    INTERNAL_WORKFLOW_SERVICE_TOKEN: token,
  },
}));

vi.mock("../src/services/workflow-control", () => ({
  executeLocalWorkflowCommand,
}));

import { describe, expect, it, vi } from "vitest";

import { app } from "../src/server";
import workflowControlRoutes from "../src/workflow-control.route";

const command = { type: "run:cancel", runId: "wrun_test" };

describe("workflow control route", () => {
  it("rejects an unauthenticated command", async () => {
    const response = await workflowControlRoutes.request("/", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(command),
    });

    expect(response.status).toBe(401);
    expect(executeLocalWorkflowCommand).not.toHaveBeenCalled();
  });

  it("executes an authenticated, validated command", async () => {
    const response = await workflowControlRoutes.request("/", {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(command),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ type: "completed" });
    expect(executeLocalWorkflowCommand).toHaveBeenCalledWith(command);
  });

  it("answers an unexpected failure with 503 and a request id", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    executeLocalWorkflowCommand.mockRejectedValueOnce(new Error("world down"));

    const response = await app.request("/", {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(command),
    });

    expect(response.status).toBe(503);
    expect(response.headers.get("X-Request-Id")).toBeTruthy();
    expect(console.error).toHaveBeenCalledWith(
      "Workflow command failed",
      expect.objectContaining({
        requestId: response.headers.get("X-Request-Id"),
        error: expect.any(Error),
      })
    );
  });
});
