const { logger } = vi.hoisted(() => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock("@chia/observability/logger", () => ({ logger }));

import { beforeEach, describe, expect, it, vi } from "vitest";

import { AgentProvider, bindModel } from "@chia/agent-runtime/models";
import type { AgentCatalog, AgentModel } from "@chia/agent-runtime/models";
import type * as Gateway from "@chia/ai/gateway";
import { HOUSE_MODELS } from "@chia/ai/house-models";
import type { AgentTaskConfig } from "@chia/db/schema";

import { db } from "./kind.fixture";

/**
 * `resolveAgentTask` is where a task definition and the operator's row meet. Pinned: the row
 * wins where it speaks, the definition where it does not, a fixed model is bound on the house
 * key, a `"session"` default only touches the session when it follows it, and a stale pin
 * degrades to the default instead of failing the caller.
 */

const { repo } = vi.hoisted(() => ({
  repo: { getAgentTaskConfig: vi.fn() },
}));

vi.mock("@chia/db/repos/agent/config", () => repo);

const { catalogue } = vi.hoisted(() => ({
  catalogue: { listGatewayModels: vi.fn() },
}));

vi.mock("@chia/ai/gateway", async (importOriginal) => ({
  ...(await importOriginal<typeof Gateway>()),
  listGatewayModels: catalogue.listGatewayModels,
}));

const PRICING = { input: [], output: [], cacheRead: [], cacheWrite: [] };

const gatewayModel = (id: string): Gateway.GatewayModel => ({
  id,
  name: id,
  contextWindow: 200_000,
  input: ["text"],
  reasoningEfforts: null,
  supportsTemperature: true,
  pricing: PRICING,
});

const catalogModel = (providerId: string, modelId: string): AgentModel => ({
  providerId,
  modelId,
  name: modelId,
  contextWindow: 200_000,
  reasoningEfforts: null,
  supportsTemperature: true,
  input: ["text"],
  pricing: PRICING,
});

const CATALOG: AgentCatalog = {
  models: [
    catalogModel(AgentProvider.Gateway, HOUSE_MODELS.cheap),
    catalogModel(AgentProvider.Gateway, "anthropic/claude-sonnet-5"),
    catalogModel(AgentProvider.Gateway, "anthropic/claude-haiku-4.5"),
    catalogModel(AgentProvider.Gateway, "openai/gpt-5.4"),
    catalogModel(AgentProvider.OpenAI, "gpt-5.4"),
  ],
};

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
    // The house key the gateway adapter is built with; nothing is sent with it.
    vi.stubEnv("AI_GATEWAY_API_KEY", "vck-house");
    repo.getAgentTaskConfig.mockResolvedValue(undefined);
  });

  it("runs on the definition's house model, prompt and parameters when there is no row", async () => {
    const { AgentTaskId, AGENT_TASKS, resolveAgentTask } =
      await import("../src/tasks");
    const task = await resolveAgentTask(db, AgentTaskId.SessionTitle, {
      catalog: CATALOG,
    });
    const definition = AGENT_TASKS[AgentTaskId.SessionTitle];
    expect(task.binding.model).toMatchObject({
      providerId: AgentProvider.Gateway,
      modelId: HOUSE_MODELS.cheap,
    });
    expect(task.credentials).toEqual({});
    expect(task.systemPrompt).toBe(definition.prompt.default);
    expect(task.params).toEqual(definition.params);
  });

  it("reads the gateway catalogue when the request brought none", async () => {
    const { AgentTaskId, resolveAgentTask } = await import("../src/tasks");
    catalogue.listGatewayModels.mockResolvedValue([
      gatewayModel(HOUSE_MODELS.cheap),
    ]);

    const task = await resolveAgentTask(db, AgentTaskId.SessionTitle);

    expect(catalogue.listGatewayModels).toHaveBeenCalledOnce();
    expect(task.binding.model.modelId).toBe(HOUSE_MODELS.cheap);
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
    const task = await resolveAgentTask(db, AgentTaskId.SessionTitle, {
      catalog: CATALOG,
    });
    expect(task.binding.model.modelId).toBe("anthropic/claude-sonnet-5");
    expect(task.systemPrompt).toBe("Name it tersely.");
    expect(task.params).toEqual({ maxTokens: 64, temperature: 0.7 });
  });

  it("falls back to the default model when the pinned one has left the catalogue", async () => {
    const { AgentTaskId, resolveAgentTask } = await import("../src/tasks");
    repo.getAgentTaskConfig.mockResolvedValue(
      row({ providerId: AgentProvider.Gateway, modelId: "acme/retired-model" })
    );
    const task = await resolveAgentTask(db, AgentTaskId.SessionTitle, {
      catalog: CATALOG,
    });
    expect(task.binding.model.modelId).toBe(HOUSE_MODELS.cheap);
    expect(logger.warn).toHaveBeenCalledOnce();
  });

  it("uses the session's model for a session-bound task, and only then resolves it", async () => {
    const { AgentTaskId, resolveAgentTask } = await import("../src/tasks");
    const credentials = { gateway: "byok-gateway-key" };
    const binding = bindModel(
      catalogModel(AgentProvider.Gateway, "anthropic/claude-sonnet-5"),
      credentials,
      "off"
    );
    const session = vi.fn(() => ({ binding, credentials }));

    const followed = await resolveAgentTask(db, AgentTaskId.SessionCompaction, {
      catalog: CATALOG,
      session,
    });
    expect(followed.binding).toBe(binding);
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
      catalog: CATALOG,
      session,
    });
    expect(pinned.binding.model.modelId).toBe("anthropic/claude-haiku-4.5");
    expect(pinned.credentials).toEqual({});
    expect(session).not.toHaveBeenCalled();
  });

  it("refuses a session-bound task with no session to follow", async () => {
    const { AgentTaskId, resolveAgentTask } = await import("../src/tasks");
    await expect(
      resolveAgentTask(db, AgentTaskId.SessionBranchSummary, {
        catalog: CATALOG,
      })
    ).rejects.toThrow(/no session/);
  });

  it("admits only house gateway models as a pin", async () => {
    const { assertAgentTaskModel, listAgentTaskModels } =
      await import("../src/tasks");
    expect(() =>
      assertAgentTaskModel(
        { providerId: AgentProvider.Gateway, modelId: "openai/gpt-5.4" },
        CATALOG
      )
    ).not.toThrow();
    expect(() =>
      assertAgentTaskModel(
        { providerId: AgentProvider.OpenAI, modelId: "gpt-5.4" },
        CATALOG
      )
    ).toThrow(/not available/);
    expect(() =>
      assertAgentTaskModel(
        { providerId: AgentProvider.Gateway, modelId: "acme/nope" },
        CATALOG
      )
    ).toThrow(/not available/);
    expect(
      listAgentTaskModels(CATALOG)
        .filter((model) => !model.requiresApiKey)
        .every((model) => model.providerId === AgentProvider.Gateway)
    ).toBe(true);
  });
});
