import { describe, expect, it } from "vitest";

import {
  AGENT_PROVIDERS,
  UnknownAgentModelError,
  createAgentModels,
} from "@chia/agent-core";

import {
  DEFAULT_WRITING_MODEL,
  isWritingModel,
  listWritingModels,
  resolveWritingModel,
  WRITING_SESSION_DEFAULTS,
} from "../src/models.ts";

/**
 * The policy half of model selection. It replaced a hand-written list of four ids, so what needs
 * pinning is the *shape* of the filter — a predicate that is too generous quietly exposes 26
 * vendors' models to an agent with publish rights to the blog.
 */

describe("isWritingModel", () => {
  it("admits the two vendors the agent is built against, through the gateway", () => {
    expect(
      isWritingModel({
        providerId: AGENT_PROVIDERS.gateway,
        modelId: "anthropic/claude-sonnet-5",
      })
    ).toBe(true);
    expect(
      isWritingModel({
        providerId: AGENT_PROVIDERS.gateway,
        modelId: "openai/gpt-5.4",
      })
    ).toBe(true);
  });

  it("refuses the gateway's other vendors", () => {
    for (const modelId of [
      "google/gemini-3.1-pro",
      "xai/grok-4",
      "meta/llama-4",
    ]) {
      expect(
        isWritingModel({ providerId: AGENT_PROVIDERS.gateway, modelId })
      ).toBe(false);
    }
  });

  /** A caller who supplied their own OpenAI key is asking for OpenAI models; no second filter. */
  it("admits any model on a native provider", () => {
    expect(
      isWritingModel({ providerId: AGENT_PROVIDERS.openai, modelId: "gpt-5.2" })
    ).toBe(true);
    expect(
      isWritingModel({
        providerId: AGENT_PROVIDERS.anthropic,
        modelId: "claude-opus-5",
      })
    ).toBe(true);
  });

  it("refuses a provider the agent does not know", () => {
    expect(
      isWritingModel({ providerId: "openrouter", modelId: "gpt-5.2" })
    ).toBe(false);
  });
});

describe("resolveWritingModel", () => {
  it("resolves the session default without any caller-supplied key", () => {
    const model = resolveWritingModel(DEFAULT_WRITING_MODEL);

    expect(model.id).toBe(DEFAULT_WRITING_MODEL.modelId);
  });

  /**
   * The pair — not the id — selects the provider. Same vendor, same model family, two different
   * ids and two different payers.
   */
  it("resolves the same vendor through either provider", () => {
    const viaGateway = resolveWritingModel({
      providerId: AGENT_PROVIDERS.gateway,
      modelId: "anthropic/claude-sonnet-5",
    });
    const native = resolveWritingModel(
      { providerId: AGENT_PROVIDERS.anthropic, modelId: "claude-sonnet-5" },
      createAgentModels({ anthropic: "sk-test" })
    );

    expect(viaGateway.provider).toBe(AGENT_PROVIDERS.gateway);
    expect(native.provider).toBe(AGENT_PROVIDERS.anthropic);
  });

  it("refuses a gateway model outside the two admitted vendors", () => {
    expect(() =>
      resolveWritingModel({
        providerId: AGENT_PROVIDERS.gateway,
        modelId: "google/gemini-3.1-pro",
      })
    ).toThrow(UnknownAgentModelError);
  });

  it("refuses a native model when the caller supplied no key for it", () => {
    expect(() =>
      resolveWritingModel({
        providerId: AGENT_PROVIDERS.openai,
        modelId: "gpt-5.2",
      })
    ).toThrow(UnknownAgentModelError);
  });
});

describe("listWritingModels", () => {
  it("offers both vendors through the gateway and nothing else from it", () => {
    const gateway = listWritingModels().filter(
      (model) => model.providerId === AGENT_PROVIDERS.gateway
    );

    expect(gateway.length).toBeGreaterThan(0);
    expect(
      gateway.every(
        (model) =>
          model.modelId.startsWith("anthropic/") ||
          model.modelId.startsWith("openai/")
      )
    ).toBe(true);
  });

  it("includes both native providers, flagged as needing a key", () => {
    const native = listWritingModels().filter(
      (model) => model.providerId !== AGENT_PROVIDERS.gateway
    );

    expect(new Set(native.map((model) => model.providerId))).toEqual(
      new Set([AGENT_PROVIDERS.openai, AGENT_PROVIDERS.anthropic])
    );
    expect(native.every((model) => model.requiresApiKey)).toBe(true);
  });
});

describe("WRITING_SESSION_DEFAULTS", () => {
  /** A new session must keep landing on the house gateway account, key or no key. */
  it("defaults a new session to the gateway", () => {
    expect(WRITING_SESSION_DEFAULTS.providerId).toBe(AGENT_PROVIDERS.gateway);
    expect(isWritingModel(DEFAULT_WRITING_MODEL)).toBe(true);
  });
});
