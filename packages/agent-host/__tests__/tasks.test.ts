const { logger } = vi.hoisted(() => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock("@chia/observability/logger", () => ({ logger }));

import { beforeEach, describe, expect, it, vi } from "vitest";

import { AgentProvider } from "@chia/agent-runtime/models";
import { HOUSE_MODELS } from "@chia/ai/house-models";
import type { AgentTaskConfig } from "@chia/db/schema";

import { db } from "./kind.fixture";

/**
 * `resolveAgentTask` is where a task definition and the operator's row meet. Pinned: the row
 * wins where it speaks, the definition where it does not, a fixed model is resolved on the
 * house collection, a `"session"` default only touches the session when it follows it, and a
 * stale pin degrades to the default instead of failing the caller.
 */

const { repo } = vi.hoisted(() => ({
  repo: { getAgentTaskConfig: vi.fn() },
}));

vi.mock("@chia/db/repos/agent/config", () => repo);

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
    const { AgentTaskId, AGENT_TASKS, resolveAgentTask } =
      await import("../src/tasks");
    const task = await resolveAgentTask(db, AgentTaskId.SessionTitle);
    const definition = AGENT_TASKS[AgentTaskId.SessionTitle];
    expect(task.model.provider).toBe(AgentProvider.Gateway);
    expect(task.model.id).toBe(HOUSE_MODELS.cheap);
    expect(task.systemPrompt).toBe(definition.prompt.default);
    expect(task.params).toEqual(definition.params);
  });

  it("lets the row override the model, the prompt and only the parameters it sets", async () => {
    const { AgentTaskId, resolveAgentTask } = await import("../src/tasks");
    repo.getAgentTaskConfig.mockResolvedValue(
      row({
        providerId: AgentProvider.Gateway,
        modelId: "anthropic/claude-sonnet-5",
        systemPrompt: "Name it tersely.",
        params: { temperature: 0.7 },
      })
    );
    const task = await resolveAgentTask(db, AgentTaskId.SessionTitle);
    expect(task.model.id).toBe("anthropic/claude-sonnet-5");
    expect(task.systemPrompt).toBe("Name it tersely.");
    expect(task.params).toEqual({ maxTokens: 64, temperature: 0.7 });
  });

  it("falls back to the default model when the pinned one has left the catalogue", async () => {
    const { AgentTaskId, resolveAgentTask } = await import("../src/tasks");
    logger.warn.mockClear();
    repo.getAgentTaskConfig.mockResolvedValue(
      row({ providerId: AgentProvider.Gateway, modelId: "acme/retired-model" })
    );
    const task = await resolveAgentTask(db, AgentTaskId.SessionTitle);
    expect(task.model.id).toBe(HOUSE_MODELS.cheap);
    expect(logger.warn).toHaveBeenCalledOnce();
  });

  it("uses the session's model for a session-bound task, and only then resolves it", async () => {
    const { createAgentModels } = await import("@chia/agent-runtime/models");
    const { AgentTaskId, resolveAgentTask } = await import("../src/tasks");
    const models = createAgentModels();
    const sessionModel = models.getModel(
      AgentProvider.Gateway,
      "anthropic/claude-sonnet-5"
    )!;
    const credentials = { gateway: "byok-gateway-key" };
    const session = vi.fn(() => ({
      model: sessionModel,
      models,
      credentials,
    }));

    const followed = await resolveAgentTask(db, AgentTaskId.SessionCompaction, {
      session,
    });
    expect(followed.model).toBe(sessionModel);
    expect(followed.models).toBe(models);
    expect(followed.credentials).toBe(credentials);
    expect(followed.systemPrompt).toBeUndefined();
    expect(followed.params).toBeUndefined();

    session.mockClear();
    repo.getAgentTaskConfig.mockResolvedValue(
      row({
        taskId: AgentTaskId.SessionCompaction,
        providerId: AgentProvider.Gateway,
        modelId: "anthropic/claude-haiku-4.5",
      })
    );
    const pinned = await resolveAgentTask(db, AgentTaskId.SessionCompaction, {
      session,
    });
    expect(pinned.model.id).toBe("anthropic/claude-haiku-4.5");
    expect(pinned.credentials).toEqual({});
    expect(session).not.toHaveBeenCalled();
  });

  it("refuses a session-bound task with no session to follow", async () => {
    const { AgentTaskId, resolveAgentTask } = await import("../src/tasks");
    await expect(
      resolveAgentTask(db, AgentTaskId.SessionBranchSummary)
    ).rejects.toThrow(/no session/);
  });

  it("admits only house gateway models as a pin", async () => {
    const { assertAgentTaskModel } = await import("../src/tasks");
    expect(() =>
      assertAgentTaskModel({
        providerId: AgentProvider.Gateway,
        modelId: "openai/gpt-5.4",
      })
    ).not.toThrow();
    expect(() =>
      assertAgentTaskModel({
        providerId: AgentProvider.OpenAI,
        modelId: "gpt-5.4",
      })
    ).toThrow(/not available/);
    expect(() =>
      assertAgentTaskModel({
        providerId: AgentProvider.Gateway,
        modelId: "acme/nope",
      })
    ).toThrow(/not available/);
  });
});
