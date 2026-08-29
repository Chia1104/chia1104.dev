import { describe, expect, it } from "vitest";

import {
  AGENT_PROVIDERS,
  UnknownAgentModelError,
  createAgentModels,
} from "@chia/agent-runtime/models";

import {
  assertPublicModel,
  DEFAULT_PUBLIC_MODEL,
  HOUSE_PUBLIC_MODEL_IDS,
  isPublicModel,
  listPublicModels,
  PUBLIC_SESSION_DEFAULTS,
  resolvePublicModel,
} from "../src/models.ts";

/**
 * The cost boundary of the public kind. The house pays for every gateway call a visitor makes,
 * so what needs pinning is that the gateway side is a closed list of cheap ids — a vendor
 * prefix would let a visitor pick the vendor's flagship.
 */

describe("isPublicModel", () => {
  it("admits the listed house models through the gateway", () => {
    for (const modelId of HOUSE_PUBLIC_MODEL_IDS) {
      expect(
        isPublicModel({ providerId: AGENT_PROVIDERS.gateway, modelId })
      ).toBe(true);
    }
  });

  it("refuses the same vendors' expensive models through the gateway", () => {
    for (const modelId of [
      "anthropic/claude-sonnet-5",
      "anthropic/claude-opus-5",
      "openai/gpt-5.4",
      "google/gemini-3-flash",
    ]) {
      expect(
        isPublicModel({ providerId: AGENT_PROVIDERS.gateway, modelId })
      ).toBe(false);
    }
  });

  /** A visitor who supplied their own key is paying for the call; no second filter. */
  it("admits any model on a native provider", () => {
    expect(
      isPublicModel({ providerId: AGENT_PROVIDERS.openai, modelId: "gpt-5.4" })
    ).toBe(true);
    expect(
      isPublicModel({
        providerId: AGENT_PROVIDERS.anthropic,
        modelId: "claude-opus-5",
      })
    ).toBe(true);
  });

  it("refuses a provider the agent does not know", () => {
    expect(
      isPublicModel({ providerId: "openrouter", modelId: "gpt-5-mini" })
    ).toBe(false);
  });
});

describe("resolvePublicModel", () => {
  it("resolves the session default without any caller-supplied key", () => {
    expect(resolvePublicModel(DEFAULT_PUBLIC_MODEL).id).toBe(
      DEFAULT_PUBLIC_MODEL.modelId
    );
  });

  it("resolves a native model only on a collection that carries its key", () => {
    const ref = {
      providerId: AGENT_PROVIDERS.anthropic,
      modelId: "claude-sonnet-5",
    };

    expect(() => resolvePublicModel(ref)).toThrow(UnknownAgentModelError);
    expect(
      resolvePublicModel(ref, createAgentModels({ anthropic: "sk-test" }))
        .provider
    ).toBe(AGENT_PROVIDERS.anthropic);
  });

  it("refuses a gateway model off the house list", () => {
    expect(() =>
      resolvePublicModel({
        providerId: AGENT_PROVIDERS.gateway,
        modelId: "anthropic/claude-sonnet-5",
      })
    ).toThrow(UnknownAgentModelError);
  });
});

describe("assertPublicModel", () => {
  it("accepts every house model and a native model with no key registered", () => {
    for (const modelId of HOUSE_PUBLIC_MODEL_IDS) {
      expect(() =>
        assertPublicModel({ providerId: AGENT_PROVIDERS.gateway, modelId })
      ).not.toThrow();
    }
    expect(() =>
      assertPublicModel({
        providerId: AGENT_PROVIDERS.openai,
        modelId: "gpt-5.2",
      })
    ).not.toThrow();
  });

  it("rejects an id policy admits but the catalogue has never heard of", () => {
    expect(() =>
      assertPublicModel({
        providerId: AGENT_PROVIDERS.openai,
        modelId: "gpt-does-not-exist",
      })
    ).toThrow(UnknownAgentModelError);
  });
});

describe("listPublicModels", () => {
  it("offers exactly the house list through the gateway", () => {
    const gateway = listPublicModels()
      .filter((model) => model.providerId === AGENT_PROVIDERS.gateway)
      .map((model) => model.modelId);

    expect(new Set(gateway)).toEqual(HOUSE_PUBLIC_MODEL_IDS);
  });

  it("includes both native providers, flagged as needing a key", () => {
    const native = listPublicModels().filter(
      (model) => model.providerId !== AGENT_PROVIDERS.gateway
    );

    expect(new Set(native.map((model) => model.providerId))).toEqual(
      new Set([AGENT_PROVIDERS.openai, AGENT_PROVIDERS.anthropic])
    );
    expect(native.every((model) => model.requiresApiKey)).toBe(true);
  });
});

describe("PUBLIC_SESSION_DEFAULTS", () => {
  it("defaults a new session to a house model", () => {
    expect(PUBLIC_SESSION_DEFAULTS.providerId).toBe(AGENT_PROVIDERS.gateway);
    expect(isPublicModel(DEFAULT_PUBLIC_MODEL)).toBe(true);
  });
});
