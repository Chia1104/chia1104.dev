import type * as AnthropicAdapters from "@tanstack/ai-anthropic";
import type * as OpenAIAdapters from "@tanstack/ai-openai";
import type * as GatewayAdapters from "@tanstack/ai-vercel-gateway";

import type * as GatewayCatalogue from "@chia/ai/gateway";

const { catalogue } = vi.hoisted(() => {
  const flat = (perToken: number) => [{ perToken, minTokens: 0 }];
  const model = (
    id: string,
    overrides: Partial<GatewayCatalogue.GatewayModel> = {}
  ): GatewayCatalogue.GatewayModel => ({
    id,
    name: id,
    contextWindow: 200_000,
    input: ["text"],
    reasoningEfforts: null,
    supportsTemperature: true,
    pricing: {
      input: flat(0.000_003),
      output: flat(0.000_015),
      cacheRead: flat(0.000_000_3),
      cacheWrite: flat(0.000_003_75),
    },
    ...overrides,
  });
  return {
    catalogue: [
      model("anthropic/claude-sonnet-5", {
        name: "Claude Sonnet 5",
        contextWindow: 1_000_000,
        input: ["text", "image"],
        // Reasons on a token budget only.
        reasoningEfforts: [],
      }),
      model("anthropic/claude-haiku-4.5", { name: "Claude Haiku 4.5" }),
      model("openai/gpt-5.2", {
        name: "GPT-5.2",
        reasoningEfforts: ["none", "low", "medium", "high", "xhigh"],
        supportsTemperature: false,
      }),
      model("openai/gpt-5", {
        name: "GPT-5",
        reasoningEfforts: ["minimal", "low", "medium", "high"],
        supportsTemperature: false,
      }),
      model("google/gemini-2.5-pro", { reasoningEfforts: ["low", "high"] }),
      // Neither the gateway adapter's id nor an OpenAI entry, whatever its slug says.
      model("acme/gpt-5-mini"),
    ],
  };
});

vi.mock("@chia/ai/gateway", async (importOriginal) => ({
  ...(await importOriginal<typeof GatewayCatalogue>()),
  listGatewayModels: vi.fn(async () => catalogue),
}));

vi.mock("@tanstack/ai-vercel-gateway", async (importOriginal) => ({
  ...(await importOriginal<typeof GatewayAdapters>()),
  vercelGatewayText: vi.fn((model: string) => ({ via: "house", model })),
  createVercelGatewayText: vi.fn((model: string, apiKey: string) => ({
    via: "gateway",
    model,
    apiKey,
  })),
}));

vi.mock("@tanstack/ai-openai", async (importOriginal) => ({
  ...(await importOriginal<typeof OpenAIAdapters>()),
  createOpenaiChat: vi.fn((model: string, apiKey: string) => ({
    via: "openai",
    model,
    apiKey,
  })),
}));

vi.mock("@tanstack/ai-anthropic", async (importOriginal) => ({
  ...(await importOriginal<typeof AnthropicAdapters>()),
  createAnthropicChat: vi.fn((model: string, apiKey: string) => ({
    via: "anthropic",
    model,
    apiKey,
  })),
}));

import type { TokenUsage } from "@tanstack/ai";
import { beforeAll, describe, expect, it, vi } from "vitest";

import { HOUSE_MODELS } from "@chia/ai/house-models";

import {
  accessOf,
  AgentProvider,
  bindModel,
  HOUSE_ACCESS,
  houseModel,
  listModels,
  loadAgentCatalog,
  NO_ACCESS,
  resolveModel,
  samplingOptions,
  UnknownAgentModelError,
  usageOf,
} from "../src/models.ts";
import type {
  AgentCatalog,
  AgentModel,
  AgentModelPredicate,
  AgentModelRef,
} from "../src/models.ts";
import { ThinkingLevel } from "../src/types.ts";

/**
 * The model layer's job is to keep two things straight: whose key pays, and which provider a
 * model id belongs to. Both fail silently when they go wrong (a turn that quietly bills the
 * house gateway account looks exactly like a working turn), so they are pinned here.
 *
 * The gateway catalogue is a fixture; the adapter factories are stubs that report the key they
 * were given. Nothing here reaches a network.
 */

const allowAll: AgentModelPredicate = () => true;

const gateway = (modelId: string): AgentModelRef => ({
  providerId: AgentProvider.Gateway,
  modelId,
});

const GATEWAY_SONNET = gateway("anthropic/claude-sonnet-5");

let catalog: AgentCatalog;

beforeAll(async () => {
  catalog = await loadAgentCatalog();
});

const modelOf = (ref: AgentModelRef): AgentModel =>
  resolveModel(ref, allowAll, catalog, HOUSE_ACCESS);

describe("accessOf", () => {
  it("reports presence per key and nothing about the keys", () => {
    expect(accessOf(undefined)).toEqual(NO_ACCESS);
    expect(accessOf({ gateway: "vck", openai: "sk" })).toEqual({
      gateway: true,
      native: [AgentProvider.OpenAI],
    });
  });
});

describe("loadAgentCatalog", () => {
  it("offers the gateway models its adapter can run, and no others", () => {
    expect(
      catalog.models
        .filter((model) => model.providerId === AgentProvider.Gateway)
        .map((model) => model.modelId)
    ).toEqual([
      "anthropic/claude-sonnet-5",
      "anthropic/claude-haiku-4.5",
      "openai/gpt-5.2",
      "openai/gpt-5",
      "google/gemini-2.5-pro",
    ]);
  });

  /**
   * The vendor packages list ids but not windows or prices, so a native model borrows the
   * gateway entry of the same model: same vendor, the id spelled with dashes where the gateway
   * has dots.
   */
  it("matches each native id to its own vendor's gateway entry", () => {
    const native = (providerId: string) =>
      catalog.models
        .filter((model) => model.providerId === providerId)
        .map((model) => model.modelId);

    expect(native(AgentProvider.OpenAI)).toEqual(["gpt-5.2", "gpt-5"]);
    expect(native(AgentProvider.Anthropic)).toEqual([
      "claude-haiku-4-5",
      "claude-sonnet-5",
    ]);
    expect(
      catalog.models.find(
        (model) =>
          model.providerId === AgentProvider.Anthropic &&
          model.modelId === "claude-haiku-4-5"
      )
    ).toMatchObject({
      name: "Claude Haiku 4.5",
      contextWindow: 200_000,
      pricing: catalogue[1]?.pricing,
    });
  });
});

describe("resolveModel", () => {
  it("resolves a pair the predicate admits to its catalogue entry", () => {
    const model = resolveModel(GATEWAY_SONNET, allowAll, catalog, NO_ACCESS);

    expect(model).toMatchObject({
      ...GATEWAY_SONNET,
      name: "Claude Sonnet 5",
      contextWindow: 1_000_000,
    });
  });

  it("rejects a pair the predicate refuses", () => {
    expect(() =>
      resolveModel(GATEWAY_SONNET, () => false, catalog, NO_ACCESS)
    ).toThrow(UnknownAgentModelError);
  });

  it("hands the predicate the caller's access", () => {
    const gatewayKeyOnly: AgentModelPredicate = (_ref, access) =>
      access.gateway;

    expect(() =>
      resolveModel(GATEWAY_SONNET, gatewayKeyOnly, catalog, NO_ACCESS)
    ).toThrow(UnknownAgentModelError);
    expect(
      resolveModel(
        GATEWAY_SONNET,
        gatewayKeyOnly,
        catalog,
        accessOf({ gateway: "vck" })
      ).modelId
    ).toBe(GATEWAY_SONNET.modelId);
  });

  /**
   * The same model carries different ids under different providers. `anthropic/claude-sonnet-5`
   * on the gateway is `claude-sonnet-5` natively. Matching on the id alone would resolve a
   * session to the wrong provider, so a mismatched pair must fail rather than fall back.
   */
  it("rejects a native model id under the gateway", () => {
    expect(() =>
      resolveModel(gateway("claude-sonnet-5"), allowAll, catalog, NO_ACCESS)
    ).toThrow(UnknownAgentModelError);
  });

  it("rejects a model the catalogue does not offer", () => {
    expect(() =>
      resolveModel(gateway("acme/gpt-5-mini"), allowAll, catalog, NO_ACCESS)
    ).toThrow(UnknownAgentModelError);
  });

  /** Whether a model exists never depends on the keys a caller registered; binding checks them. */
  it("resolves a native model the caller holds no key for", () => {
    expect(
      resolveModel(
        { providerId: AgentProvider.OpenAI, modelId: "gpt-5.2" },
        allowAll,
        catalog,
        NO_ACCESS
      ).name
    ).toBe("GPT-5.2");
  });
});

describe("houseModel", () => {
  it("names a role's model on the gateway", () => {
    expect(houseModel("cheap")).toEqual({
      providerId: AgentProvider.Gateway,
      modelId: HOUSE_MODELS.cheap,
    });
    expect(houseModel("writing").modelId).toBe(HOUSE_MODELS.writing);
    expect(houseModel("public").modelId).toBe(HOUSE_MODELS.public);
  });
});

describe("listModels", () => {
  it("describes every catalogue model from the gateway's entry", () => {
    const listed = listModels(allowAll, catalog, HOUSE_ACCESS);

    expect(listed).toHaveLength(catalog.models.length);
    expect(listed[0]).toEqual({
      ...GATEWAY_SONNET,
      name: "Claude Sonnet 5",
      contextWindow: 1_000_000,
      supportsReasoning: true,
      supportsImageInput: true,
      requiresApiKey: false,
    });
    expect(listed[1]).toMatchObject({
      supportsReasoning: false,
      supportsImageInput: false,
    });
  });

  /**
   * The picker lists models the caller cannot yet use, flagged rather than hidden: hiding
   * them would leave no way to discover that registering a key unlocks them.
   */
  it("flags what the predicate refuses instead of hiding it", () => {
    const listed = listModels(
      (ref) => ref.modelId === GATEWAY_SONNET.modelId,
      catalog,
      HOUSE_ACCESS
    );
    const usable = listed.filter((model) => !model.requiresApiKey);

    expect(listed.length).toBeGreaterThan(1);
    expect(usable).toHaveLength(1);
    expect(usable[0]?.providerId).toBe(AgentProvider.Gateway);
  });

  it("flags native models the caller has no key for", () => {
    const listed = listModels(allowAll, catalog, NO_ACCESS).filter(
      (model) => model.providerId !== AgentProvider.Gateway
    );

    expect(listed.length).toBeGreaterThan(0);
    expect(listed.every((model) => model.requiresApiKey)).toBe(true);
  });

  it("clears the flag for the provider the caller has registered, and only that one", () => {
    const listed = listModels(allowAll, catalog, accessOf({ openai: "sk" }));
    const flagged = (providerId: string) =>
      listed
        .filter((model) => model.providerId === providerId)
        .map((model) => model.requiresApiKey);

    expect(flagged(AgentProvider.OpenAI)).toEqual([false, false]);
    expect(flagged(AgentProvider.Anthropic)).toEqual([true, true]);
  });

  it("never flags the gateway on the house's behalf", () => {
    const listed = listModels(allowAll, catalog).filter(
      (model) => model.providerId === AgentProvider.Gateway
    );

    expect(listed.every((model) => !model.requiresApiKey)).toBe(true);
  });
});

describe("bindModel", () => {
  it("runs a gateway model on the house key when the caller brought no gateway key", () => {
    const binding = bindModel(
      modelOf(GATEWAY_SONNET),
      { openai: "sk-native" },
      ThinkingLevel.Off
    );

    expect(binding.adapter).toEqual({
      via: "house",
      model: GATEWAY_SONNET.modelId,
    });
    expect(binding).toMatchObject({
      api: "vercel-gateway:responses",
      promptTokensIncludeCache: true,
      modelOptions: { gateway: { caching: "auto" } },
    });
  });

  it("runs a gateway model on the caller's gateway key when they brought one", () => {
    const binding = bindModel(
      modelOf(GATEWAY_SONNET),
      { gateway: "vck-caller" },
      ThinkingLevel.Off
    );

    expect(binding.adapter).toEqual({
      via: "gateway",
      model: GATEWAY_SONNET.modelId,
      apiKey: "vck-caller",
    });
  });

  it("runs a native model on the caller's own key for that vendor", () => {
    const openai = bindModel(
      modelOf({ providerId: AgentProvider.OpenAI, modelId: "gpt-5.2" }),
      { openai: "sk-caller" },
      ThinkingLevel.High
    );
    const anthropic = bindModel(
      modelOf({
        providerId: AgentProvider.Anthropic,
        modelId: "claude-sonnet-5",
      }),
      { anthropic: "sk-ant-caller" },
      ThinkingLevel.High
    );

    expect(openai).toMatchObject({
      adapter: { via: "openai", model: "gpt-5.2", apiKey: "sk-caller" },
      api: "openai:responses",
      promptTokensIncludeCache: true,
      modelOptions: { reasoning: { effort: "high", summary: "auto" } },
    });
    expect(anthropic).toMatchObject({
      adapter: {
        via: "anthropic",
        model: "claude-sonnet-5",
        apiKey: "sk-ant-caller",
      },
      api: "anthropic:messages",
      promptTokensIncludeCache: false,
      modelOptions: {
        cache_control: { type: "ephemeral" },
        thinking: { type: "enabled", budget_tokens: 16_384 },
      },
    });
  });

  it("disables Anthropic thinking when it is off or the model does not reason", () => {
    const thinkingOf = (modelId: string, level: ThinkingLevel) =>
      bindModel(
        modelOf({ providerId: AgentProvider.Anthropic, modelId }),
        { anthropic: "sk-ant" },
        level
      ).modelOptions.thinking;

    expect(thinkingOf("claude-sonnet-5", ThinkingLevel.Off)).toEqual({
      type: "disabled",
    });
    expect(thinkingOf("claude-haiku-4-5", ThinkingLevel.High)).toEqual({
      type: "disabled",
    });
  });

  /** An ambient `OPENAI_API_KEY` or another vendor's key must never open a native provider. */
  it("refuses a native model without the caller's key for that vendor", () => {
    const gpt = modelOf({
      providerId: AgentProvider.OpenAI,
      modelId: "gpt-5.2",
    });

    expect(() => bindModel(gpt, {}, ThinkingLevel.Off)).toThrow(
      UnknownAgentModelError
    );
    expect(() =>
      bindModel(gpt, { anthropic: "sk-ant", gateway: "vck" }, ThinkingLevel.Off)
    ).toThrow(/openai/);
  });

  describe("reasoning effort", () => {
    const effortOf = (modelId: string, level: ThinkingLevel) =>
      bindModel(modelOf(gateway(modelId)), {}, level).modelOptions.reasoning;

    it("sends the effort the model offers closest to the level", () => {
      expect(effortOf("openai/gpt-5", ThinkingLevel.Medium)).toEqual({
        effort: "medium",
        summary: "auto",
      });
      expect(effortOf("openai/gpt-5", ThinkingLevel.Max)).toMatchObject({
        effort: "high",
      });
      expect(effortOf("openai/gpt-5.2", ThinkingLevel.Max)).toMatchObject({
        effort: "xhigh",
      });
    });

    it("takes the lower effort on a tie, never buying more reasoning than was asked for", () => {
      expect(
        effortOf("google/gemini-2.5-pro", ThinkingLevel.Medium)
      ).toMatchObject({ effort: "low" });
      expect(effortOf("openai/gpt-5.2", ThinkingLevel.Minimal)).toMatchObject({
        effort: "none",
      });
    });

    it("sends nothing for off unless the model offers none", () => {
      expect(effortOf("openai/gpt-5", ThinkingLevel.Off)).toBeUndefined();
      expect(effortOf("openai/gpt-5.2", ThinkingLevel.Off)).toMatchObject({
        effort: "none",
      });
    });

    it("maps onto low, medium and high for a model that names no efforts", () => {
      expect(
        effortOf("anthropic/claude-sonnet-5", ThinkingLevel.XHigh)
      ).toMatchObject({ effort: "high" });
      expect(
        effortOf("anthropic/claude-sonnet-5", ThinkingLevel.Minimal)
      ).toMatchObject({ effort: "low" });
    });

    it("sends nothing for a model that does not reason", () => {
      expect(
        effortOf("anthropic/claude-haiku-4.5", ThinkingLevel.High)
      ).toBeUndefined();
    });
  });
});

describe("usageOf", () => {
  const tiered: AgentModel = {
    ...GATEWAY_SONNET,
    name: "Claude Sonnet 5",
    contextWindow: 1_000_000,
    reasoningEfforts: [],
    supportsTemperature: true,
    input: ["text"],
    pricing: {
      input: [
        { perToken: 0.000_001, minTokens: 0 },
        { perToken: 0.000_002, minTokens: 200_000 },
      ],
      output: [
        { perToken: 0.000_01, minTokens: 0 },
        { perToken: 0.000_02, minTokens: 200_000 },
      ],
      cacheRead: [{ perToken: 0.000_000_1, minTokens: 0 }],
      cacheWrite: [{ perToken: 0.000_001_25, minTokens: 0 }],
    },
  };
  const including = { model: tiered, promptTokensIncludeCache: true };
  const excluding = { model: tiered, promptTokensIncludeCache: false };

  const reported = (promptTokens: number): TokenUsage => ({
    promptTokens,
    completionTokens: 50,
    totalTokens: promptTokens + 50,
    promptTokensDetails: { cachedTokens: 600, cacheWriteTokens: 100 },
    completionTokensDetails: { reasoningTokens: 20 },
  });

  it("separates cache reads and writes from input and prices each", () => {
    const usage = usageOf(including, reported(1_000));

    expect(usage).toMatchObject({
      input: 300,
      output: 50,
      cacheRead: 600,
      cacheWrite: 100,
      reasoning: 20,
      totalTokens: 1_050,
    });
    expect(usage.cost.input).toBeCloseTo(300 * 0.000_001);
    expect(usage.cost.output).toBeCloseTo(50 * 0.000_01);
    expect(usage.cost.cacheRead).toBeCloseTo(600 * 0.000_000_1);
    expect(usage.cost.cacheWrite).toBeCloseTo(100 * 0.000_001_25);
    expect(usage.cost.total).toBeCloseTo(
      usage.cost.input +
        usage.cost.output +
        usage.cost.cacheRead +
        usage.cost.cacheWrite
    );
  });

  it("reads the same call alike whichever way the adapter counts its prompt", () => {
    expect(usageOf(excluding, reported(300))).toEqual(
      usageOf(including, reported(1_000))
    );
  });

  it("prices every token at the tier the whole prompt reaches, cache included", () => {
    // 199,500 uncached tokens alone sit under the step; with the cache the prompt is past it.
    const usage = usageOf(excluding, reported(199_500));

    expect(usage.cost.input).toBeCloseTo(199_500 * 0.000_002);
    expect(usage.cost.output).toBeCloseTo(50 * 0.000_02);
  });

  it("never reports negative input when the adapter's cache figures exceed its prompt", () => {
    expect(usageOf(including, reported(500)).input).toBe(0);
  });
});

describe("samplingOptions", () => {
  const sonnet = () => modelOf(GATEWAY_SONNET);
  const gpt = () => modelOf(gateway("openai/gpt-5.2"));

  it("spells the output cap the way the binding's API takes it", () => {
    expect(
      samplingOptions(
        { api: "vercel-gateway:responses", model: sonnet() },
        { maxTokens: 64, temperature: 0.2 }
      )
    ).toEqual({ max_output_tokens: 64, temperature: 0.2 });
    expect(
      samplingOptions(
        { api: "anthropic:messages", model: sonnet() },
        { maxTokens: 64 }
      )
    ).toEqual({ max_tokens: 64 });
  });

  it("drops a temperature the model refuses", () => {
    expect(
      samplingOptions(
        { api: "vercel-gateway:responses", model: gpt() },
        { maxTokens: 64, temperature: 0.2 }
      )
    ).toEqual({ max_output_tokens: 64 });
  });

  it("sends nothing when nothing was asked for", () => {
    expect(
      samplingOptions({ api: "openai:responses", model: gpt() }, {})
    ).toEqual({});
  });
});
