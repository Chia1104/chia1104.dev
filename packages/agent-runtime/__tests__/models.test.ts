import { calculateCost } from "@earendil-works/pi-ai";
import { describe, expect, it } from "vitest";

import type { GatewayModelPricing } from "@chia/ai/gateway";
import { HOUSE_MODELS } from "@chia/ai/house-models";

import {
  accessOf,
  AgentProvider,
  createAgentCatalog,
  createAgentModels,
  HOUSE_ACCESS,
  houseModel,
  listModels,
  NO_ACCESS,
  resolveModel,
  UnknownAgentModelError,
  withGatewayPricing,
} from "../src/models.ts";
import type { AgentModelPredicate, AgentModelRef } from "../src/models.ts";

/**
 * The model layer's job is to keep two things straight: whose key pays, and which provider a
 * model id belongs to. Both fail silently when they go wrong (a turn that quietly bills the
 * house gateway account looks exactly like a working turn), so they are pinned here.
 *
 * These use pi-ai's real providers. Offline-safe: all three ship static catalogues and perform
 * no I/O when registered.
 */

const allowAll: AgentModelPredicate = () => true;

const GATEWAY_SONNET: AgentModelRef = {
  providerId: AgentProvider.Gateway,
  modelId: "anthropic/claude-sonnet-5",
};

describe("accessOf", () => {
  it("reports presence per key and nothing about the keys", () => {
    expect(accessOf(undefined)).toEqual(NO_ACCESS);
    expect(accessOf({ gateway: "vck", openai: "sk" })).toEqual({
      gateway: true,
      native: [AgentProvider.OpenAI],
    });
  });
});

describe("createAgentModels", () => {
  it("registers the gateway with no credentials, because it runs on the house env key", () => {
    const models = createAgentModels();

    expect(models.getProvider(AgentProvider.Gateway)).toBeDefined();
    expect(
      models.getModel(GATEWAY_SONNET.providerId, GATEWAY_SONNET.modelId)
    ).toBeDefined();
  });

  /**
   * pi-ai falls back to ambient env vars (`OPENAI_API_KEY`, `ANTHROPIC_API_KEY`) when no
   * credential is stored, and a developer shell may well carry them. A provider registered
   * unconditionally would resolve against that key and bill it.
   */
  it("omits a native provider entirely when its key was not supplied", () => {
    const models = createAgentModels();

    expect(models.getProvider(AgentProvider.OpenAI)).toBeUndefined();
    expect(models.getProvider(AgentProvider.Anthropic)).toBeUndefined();
  });

  it("registers only the native provider whose key was supplied", () => {
    const models = createAgentModels({ openai: "sk-test" });

    expect(models.getProvider(AgentProvider.OpenAI)).toBeDefined();
    expect(models.getProvider(AgentProvider.Anthropic)).toBeUndefined();
  });

  it("resolves a supplied vendor key ahead of the ambient environment", async () => {
    const models = createAgentModels({ anthropic: "sk-supplied" });

    const auth = await models.getAuth(AgentProvider.Anthropic);

    expect(auth?.auth.apiKey).toBe("sk-supplied");
  });

  it("resolves a supplied gateway key ahead of the house env key", async () => {
    const models = createAgentModels({ gateway: "vck-supplied" });

    const auth = await models.getAuth(AgentProvider.Gateway);

    expect(auth?.auth.apiKey).toBe("vck-supplied");
  });
});

describe("resolveModel", () => {
  it("resolves a pair the predicate admits", () => {
    const model = resolveModel(
      GATEWAY_SONNET,
      allowAll,
      createAgentModels(),
      NO_ACCESS
    );

    expect(model.id).toBe(GATEWAY_SONNET.modelId);
    expect(model.contextWindow).toBeGreaterThan(0);
  });

  it("rejects a pair the predicate refuses", () => {
    expect(() =>
      resolveModel(GATEWAY_SONNET, () => false, createAgentModels(), NO_ACCESS)
    ).toThrow(UnknownAgentModelError);
  });

  it("hands the predicate the caller's access", () => {
    const gatewayKeyOnly: AgentModelPredicate = (_ref, access) =>
      access.gateway;

    expect(() =>
      resolveModel(
        GATEWAY_SONNET,
        gatewayKeyOnly,
        createAgentModels(),
        NO_ACCESS
      )
    ).toThrow(UnknownAgentModelError);
    expect(
      resolveModel(
        GATEWAY_SONNET,
        gatewayKeyOnly,
        createAgentModels({ gateway: "vck" }),
        accessOf({ gateway: "vck" })
      ).id
    ).toBe(GATEWAY_SONNET.modelId);
  });

  /**
   * The same model carries different ids under different providers. `anthropic/claude-sonnet-5`
   * on the gateway is `claude-sonnet-5` natively. Matching on the id alone would resolve a
   * session to the wrong provider, so a mismatched pair must fail rather than fall back.
   */
  it("rejects a native model id under the gateway", () => {
    expect(() =>
      resolveModel(
        { providerId: AgentProvider.Gateway, modelId: "claude-sonnet-5" },
        allowAll,
        createAgentModels(),
        NO_ACCESS
      )
    ).toThrow(UnknownAgentModelError);
  });

  it("rejects a model on a native provider with no key, naming the provider", () => {
    expect(() =>
      resolveModel(
        { providerId: AgentProvider.OpenAI, modelId: "gpt-5.2" },
        allowAll,
        createAgentModels(),
        NO_ACCESS
      )
    ).toThrow(/openai/);
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
  it("enumerates the catalogue rather than a hand-written list", () => {
    const gateway = listModels(allowAll, { access: HOUSE_ACCESS }).filter(
      (model) => model.providerId === AgentProvider.Gateway
    );

    // The exact count tracks pi-ai's bundled catalogue; only the order of magnitude is the
    // point.
    expect(gateway.length).toBeGreaterThan(100);
    expect(gateway.every((model) => model.name.length > 0)).toBe(true);
    expect(gateway.every((model) => model.contextWindow > 0)).toBe(true);
  });

  /**
   * The picker lists models the caller cannot yet use, flagged rather than hidden: hiding
   * them would leave no way to discover that registering a key unlocks them.
   */
  it("flags what the predicate refuses instead of hiding it", () => {
    const listed = listModels(
      (ref) => ref.modelId === "anthropic/claude-sonnet-5",
      { access: HOUSE_ACCESS }
    );
    const usable = listed.filter((model) => !model.requiresApiKey);

    expect(listed.length).toBeGreaterThan(1);
    expect(usable).toHaveLength(1);
    expect(usable[0]?.providerId).toBe(AgentProvider.Gateway);
  });

  it("flags native models the caller has no key for", () => {
    const listed = listModels(allowAll, {
      models: createAgentCatalog(),
      access: NO_ACCESS,
    }).filter((model) => model.providerId === AgentProvider.OpenAI);

    expect(listed.length).toBeGreaterThan(0);
    expect(listed.every((model) => model.requiresApiKey)).toBe(true);
  });

  it("clears the flag for a provider the caller has registered", () => {
    const listed = listModels(allowAll, {
      access: accessOf({ openai: "sk" }),
    }).filter((model) => model.providerId === AgentProvider.OpenAI);

    expect(listed.every((model) => !model.requiresApiKey)).toBe(true);
  });

  it("never flags the gateway on the house's behalf", () => {
    const listed = listModels(allowAll, { access: NO_ACCESS }).filter(
      (model) => model.providerId === AgentProvider.Gateway
    );

    expect(listed.every((model) => !model.requiresApiKey)).toBe(true);
  });
});

/** `openai/gpt-6-luna` as the gateway listed it: the price doubles past 272k prompt tokens. */
const LUNA_PRICING: GatewayModelPricing = {
  input: [
    { perToken: 0.000_000_1, minTokens: 0 },
    { perToken: 0.000_000_2, minTokens: 272_001 },
  ],
  output: [
    { perToken: 0.000_000_5, minTokens: 0 },
    { perToken: 0.000_000_75, minTokens: 272_001 },
  ],
  cacheRead: [{ perToken: 0.000_000_01, minTokens: 0 }],
  cacheWrite: [],
};

describe("withGatewayPricing", () => {
  const luna = () => {
    const model = createAgentModels().getModel(
      AgentProvider.Gateway,
      "openai/gpt-6-luna"
    );
    if (!model) throw new Error("Pi's catalogue has no openai/gpt-6-luna.");
    return model;
  };

  it("prices per million tokens and turns the gateway's tiers into Pi's", () => {
    const priced = withGatewayPricing(luna(), LUNA_PRICING);

    expect(priced.cost).toEqual({
      input: 0.1,
      output: 0.5,
      cacheRead: 0.01,
      // No gateway price listed: Pi's own stays.
      cacheWrite: luna().cost.cacheWrite,
      tiers: [
        {
          inputTokensAbove: 272_000,
          input: 0.2,
          output: 0.75,
          cacheRead: 0.01,
          cacheWrite: luna().cost.cacheWrite,
        },
      ],
    });
    // Everything but the price is Pi's.
    expect({ ...priced, cost: undefined }).toEqual({
      ...luna(),
      cost: undefined,
    });
  });

  it("bills a prompt past the threshold at the higher rate", () => {
    const priced = withGatewayPricing(luna(), LUNA_PRICING);
    const usage = (input: number) => ({
      input,
      output: 1_000_000,
      cacheRead: 0,
      cacheWrite: 0,
      totalTokens: input + 1_000_000,
      cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
    });

    expect(calculateCost(priced, usage(100_000)).output).toBeCloseTo(0.5);
    expect(calculateCost(priced, usage(300_000)).output).toBeCloseTo(0.75);
  });

  it("keeps Pi's prices when the gateway lists none", () => {
    expect(withGatewayPricing(luna(), undefined)).toEqual(luna());
    expect(withGatewayPricing(luna(), { ...LUNA_PRICING, input: [] })).toEqual(
      luna()
    );
  });

  it("reprices only the gateway's models", () => {
    const models = createAgentModels(
      { anthropic: "sk" },
      new Map([["openai/gpt-6-luna", LUNA_PRICING]])
    );

    expect(
      models.getModel(AgentProvider.Gateway, "openai/gpt-6-luna")?.cost.tiers
    ).toHaveLength(1);
    expect(
      models.getModel(AgentProvider.Gateway, "anthropic/claude-sonnet-5")
    ).toEqual(
      createAgentModels().getModel(
        AgentProvider.Gateway,
        "anthropic/claude-sonnet-5"
      )
    );
  });
});
