import { vi } from "vitest";

import type { DB } from "@chia/db/client";
import type { AgentTaskConfig } from "@chia/db/schema";

/**
 * `resolveAgentTask` is where a task definition and the operator's row meet. Pinned here: the
 * row wins where it speaks, the definition where it does not, a fixed model is resolved on the
 * house collection, a `"session"` default only touches the session when it follows it, and a
 * stale pin degrades to the default instead of failing the caller.
 */

const { repo } = vi.hoisted(() => ({
  repo: { getAgentTaskConfig: vi.fn() },
}));

vi.mock("@chia/db/repos/agent/config", () => repo);

const db = /* SAFETY: the repo is mocked; nothing reads the handle. */ {} as DB;

const row = (overrides: Partial<AgentTaskConfig> = {}): AgentTaskConfig => ({
  taskId: "session.title",
  providerId: null,
  modelId: null,
  systemPrompt: null,
  params: {},
  updatedAt: new Date("2026-08-27T00:00:00Z"),
  ...overrides,
});

describe("resolveAgentTask", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    repo.getAgentTaskConfig.mockResolvedValue(undefined);
  });

  it("runs on the definition's house model, prompt and parameters when there is no row", async () => {
    const { AGENT_TASK_IDS, AGENT_TASKS, resolveAgentTask } =
      await import("../src/agents/tasks");
    const task = await resolveAgentTask(db, AGENT_TASK_IDS.sessionTitle);
    const definition = AGENT_TASKS[AGENT_TASK_IDS.sessionTitle];
    expect(task.model.provider).toBe("vercel-ai-gateway");
    expect(task.model.id).toBe("anthropic/claude-haiku-4.5");
    expect(task.systemPrompt).toBe(definition.prompt.default);
    expect(task.params).toEqual(definition.params);
  });

  it("lets the row override the model, the prompt and only the parameters it sets", async () => {
    const { AGENT_TASK_IDS, resolveAgentTask } =
      await import("../src/agents/tasks");
    repo.getAgentTaskConfig.mockResolvedValue(
      row({
        providerId: "vercel-ai-gateway",
        modelId: "anthropic/claude-sonnet-5",
        systemPrompt: "Name it tersely.",
        params: { temperature: 0.7 },
      })
    );
    const task = await resolveAgentTask(db, AGENT_TASK_IDS.sessionTitle);
    expect(task.model.id).toBe("anthropic/claude-sonnet-5");
    expect(task.systemPrompt).toBe("Name it tersely.");
    expect(task.params).toEqual({ maxTokens: 64, temperature: 0.7 });
  });

  it("falls back to the default model when the pinned one has left the catalogue", async () => {
    const { AGENT_TASK_IDS, resolveAgentTask } =
      await import("../src/agents/tasks");
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    repo.getAgentTaskConfig.mockResolvedValue(
      row({ providerId: "vercel-ai-gateway", modelId: "acme/retired-model" })
    );
    const task = await resolveAgentTask(db, AGENT_TASK_IDS.sessionTitle);
    expect(task.model.id).toBe("anthropic/claude-haiku-4.5");
    expect(warn).toHaveBeenCalledOnce();
    warn.mockRestore();
  });

  it("uses the session's model for a session-bound task, and only then resolves it", async () => {
    const { createAgentModels } = await import("@chia/agent-runtime/models");
    const { AGENT_TASK_IDS, resolveAgentTask } =
      await import("../src/agents/tasks");
    const models = createAgentModels();
    const sessionModel = models.getModel(
      "vercel-ai-gateway",
      "anthropic/claude-sonnet-5"
    )!;
    const session = vi.fn(() => ({ model: sessionModel, models }));

    const followed = await resolveAgentTask(
      db,
      AGENT_TASK_IDS.sessionCompaction,
      { session }
    );
    expect(followed.model).toBe(sessionModel);
    expect(followed.models).toBe(models);
    expect(followed.systemPrompt).toBeUndefined();
    expect(followed.params).toBeUndefined();

    session.mockClear();
    repo.getAgentTaskConfig.mockResolvedValue(
      row({
        taskId: AGENT_TASK_IDS.sessionCompaction,
        providerId: "vercel-ai-gateway",
        modelId: "anthropic/claude-haiku-4.5",
      })
    );
    const pinned = await resolveAgentTask(
      db,
      AGENT_TASK_IDS.sessionCompaction,
      { session }
    );
    expect(pinned.model.id).toBe("anthropic/claude-haiku-4.5");
    expect(session).not.toHaveBeenCalled();
  });

  it("refuses a session-bound task with no session to follow", async () => {
    const { AGENT_TASK_IDS, resolveAgentTask } =
      await import("../src/agents/tasks");
    await expect(
      resolveAgentTask(db, AGENT_TASK_IDS.sessionBranchSummary)
    ).rejects.toThrow(/no session/);
  });

  it("admits only house gateway models as a pin", async () => {
    const { assertAgentTaskModel } = await import("../src/agents/tasks");
    expect(() =>
      assertAgentTaskModel({
        providerId: "vercel-ai-gateway",
        modelId: "openai/gpt-5.4",
      })
    ).not.toThrow();
    expect(() =>
      assertAgentTaskModel({ providerId: "openai", modelId: "gpt-5.4" })
    ).toThrow(/not available/);
    expect(() =>
      assertAgentTaskModel({
        providerId: "vercel-ai-gateway",
        modelId: "acme/nope",
      })
    ).toThrow(/not available/);
  });
});
