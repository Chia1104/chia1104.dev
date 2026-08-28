import { createWorkflowControlClient } from "../src/client";
describe("workflow control client", () => {
  it("sends authenticated commands to the workflow service", async () => {
    const fetcher = vi.fn(async () =>
      Response.json({ type: "started", runId: "wrun_remote" })
    );
    const control = createWorkflowControlClient({
      url: "http://workflow.internal/",
      token: "a".repeat(32),
      fetch: fetcher,
    });

    await expect(
      control.startResourceIndex({ sourceType: "agent_memory", sourceId: 7 })
    ).resolves.toBe("wrun_remote");

    expect(fetcher).toHaveBeenCalledOnce();
    expect(fetcher).toHaveBeenCalledWith(
      "http://workflow.internal/",
      expect.objectContaining({
        method: "POST",
        headers: {
          authorization: `Bearer ${"a".repeat(32)}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          type: "resource-index:start",
          request: { sourceType: "agent_memory", sourceId: 7 },
        }),
      })
    );
  });

  it("carries the remote AppError status back as the AppError code", async () => {
    const fetcher = vi.fn(async () =>
      Response.json({ error: "Run not found." }, { status: 404 })
    );
    const control = createWorkflowControlClient({
      url: "http://workflow.internal/",
      token: "a".repeat(32),
      fetch: fetcher,
    });

    await expect(control.cancelRun("wrun_missing")).rejects.toMatchObject({
      code: "NOT_FOUND",
      message: "Run not found.",
    });
  });

  it("does not expose a remote service error body as a successful result", async () => {
    const fetcher = vi.fn(async () =>
      Response.json({ error: "Workflow command failed." }, { status: 503 })
    );
    const control = createWorkflowControlClient({
      url: "http://workflow.internal/",
      token: "a".repeat(32),
      fetch: fetcher,
    });

    await expect(control.cancelRun("wrun_1")).rejects.toThrow(
      "Workflow command failed."
    );
  });
});
