import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@chia/observability/logger", () => ({
  logger: { warn: vi.fn() },
}));

const catalogue = {
  data: [
    {
      id: "openai/gpt-6-luna",
      name: "GPT-6 Luna",
      type: "language",
      context_window: 1_050_000,
      max_tokens: 128_000,
      modalities: { input: ["text", "image"], output: ["text"] },
      reasoning_options: [
        { type: "toggle" },
        { type: "effort", values: ["none", "low", "high"] },
      ],
      temperature: false,
      pricing: {
        input: "0.0000001",
        output: "0.0000005",
        input_cache_read: "0.00000001",
        input_tiers: [
          { cost: "0.0000002", min: 272_001 },
          { cost: "0.0000001", min: 0, max: 272_001 },
        ],
      },
    },
    {
      id: "anthropic/claude-haiku-4.5",
      name: "Claude Haiku 4.5",
      type: "language",
      context_window: 200_000,
      reasoning_options: [{ type: "budget_tokens", min: 1024 }],
      pricing: { input: "0.000001", output: "0.000005" },
    },
    { id: "openai/text-embedding-3", name: "Embedding", type: "embedding" },
    { id: "broken/model", name: "No window", type: "language", pricing: {} },
  ],
};

const respond = (body: typeof catalogue | { error: string }, status = 200) =>
  Promise.resolve(new Response(JSON.stringify(body), { status }));

describe("listGatewayModels", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("reads language models, their windows, reasoning controls and tiered prices", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => respond(catalogue))
    );
    const { listGatewayModels } = await import("../src/gateway.ts");

    const models = await listGatewayModels();

    expect(models.map((model) => model.id)).toEqual([
      "openai/gpt-6-luna",
      "anthropic/claude-haiku-4.5",
    ]);
    expect(models[0]).toMatchObject({
      contextWindow: 1_050_000,
      maxOutputTokens: 128_000,
      input: ["text", "image"],
      reasoningEfforts: ["none", "low", "high"],
      supportsTemperature: false,
      pricing: {
        input: [
          { perToken: 0.000_000_1, minTokens: 0 },
          { perToken: 0.000_000_2, minTokens: 272_001 },
        ],
        output: [{ perToken: 0.000_000_5, minTokens: 0 }],
        cacheRead: [{ perToken: 0.000_000_01, minTokens: 0 }],
        cacheWrite: [],
      },
    });
    // A budget-only reasoning model takes no effort names; it still reasons.
    expect(models[1]).toMatchObject({
      reasoningEfforts: [],
      supportsTemperature: true,
      input: ["text"],
    });
  });

  it("fetches at most once an hour", async () => {
    const fetch = vi.fn(() => respond(catalogue));
    vi.stubGlobal("fetch", fetch);
    const { listGatewayModels } = await import("../src/gateway.ts");

    await listGatewayModels();
    await listGatewayModels();
    expect(fetch).toHaveBeenCalledOnce();

    vi.advanceTimersByTime(60 * 60 * 1000 + 1);
    await listGatewayModels();
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("serves the previous copy when a refresh fails, and fails with none to serve", async () => {
    const fetch = vi.fn(() => respond({ error: "down" }, 503));
    vi.stubGlobal("fetch", fetch);
    const { listGatewayModels } = await import("../src/gateway.ts");

    await expect(listGatewayModels()).rejects.toThrow("503");

    fetch.mockImplementationOnce(() => respond(catalogue));
    const models = await listGatewayModels();
    vi.advanceTimersByTime(60 * 60 * 1000 + 1);
    await expect(listGatewayModels()).resolves.toBe(models);
  });
});

describe("tierPrice", () => {
  it("prices a prompt by the highest tier it reaches", async () => {
    const { tierPrice } = await import("../src/gateway.ts");
    const tiers = [
      { perToken: 1, minTokens: 0 },
      { perToken: 2, minTokens: 272_001 },
    ];

    expect(tierPrice(tiers, 10)).toBe(1);
    expect(tierPrice(tiers, 272_001)).toBe(2);
    expect(tierPrice([], 10)).toBe(0);
  });
});
