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
});
