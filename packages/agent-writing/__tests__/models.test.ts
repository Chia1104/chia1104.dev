import { describe, expect, it } from "vitest";

import {
  accessOf,
  AgentProvider,
  bindModel,
  HOUSE_ACCESS,
  NO_ACCESS,
  UnknownAgentModelError,
} from "@chia/agent-runtime/models";

import {
  assertWritingModel,
  DEFAULT_WRITING_MODEL,
  isWritingModel,
  listWritingModels,
  resolveWritingModel,
  WRITING_SESSION_DEFAULTS,
} from "../src/models.ts";

import { WRITING_CATALOG } from "./fixtures.ts";

/**
 * Pins the filter shape: a predicate that is too generous exposes every gateway vendor to an
 * agent with publish rights.
 */

describe("isWritingModel", () => {
  it("admits the two vendors the agent is built against, through the gateway", () => {
    expect(
      isWritingModel(
        {
          providerId: AgentProvider.Gateway,
          modelId: "anthropic/claude-sonnet-5",
        },
        NO_ACCESS
      )
    ).toBe(true);
    expect(
      isWritingModel(
        { providerId: AgentProvider.Gateway, modelId: "openai/gpt-5.4" },
        NO_ACCESS
      )
    ).toBe(true);
  });

  it("refuses the gateway's other vendors", () => {
    for (const modelId of [
      "google/gemini-3.1-pro",
      "xai/grok-4",
      "meta/llama-4",
    ]) {
      expect(
        isWritingModel(
          { providerId: AgentProvider.Gateway, modelId },
          NO_ACCESS
        )
      ).toBe(false);
    }
  });

  it("admits any model on a native provider", () => {
    expect(
      isWritingModel(
        { providerId: AgentProvider.OpenAI, modelId: "gpt-5.2" },
        NO_ACCESS
      )
    ).toBe(true);
    expect(
      isWritingModel(
        { providerId: AgentProvider.Anthropic, modelId: "claude-opus-5" },
        NO_ACCESS
      )
    ).toBe(true);
  });

  it("refuses a provider the agent does not know", () => {
    expect(
      isWritingModel(
        { providerId: "openrouter", modelId: "gpt-5.2" },
        NO_ACCESS
      )
    ).toBe(false);
  });
});

describe("resolveWritingModel", () => {
  it("resolves the session default without any caller-supplied key", () => {
    const model = resolveWritingModel(
      DEFAULT_WRITING_MODEL,
      WRITING_CATALOG,
      NO_ACCESS
    );

    expect(model).toMatchObject(DEFAULT_WRITING_MODEL);
  });

  it("resolves the same vendor through either provider", () => {
    const access = accessOf({ anthropic: "sk-test" });
    const viaGateway = resolveWritingModel(
      {
        providerId: AgentProvider.Gateway,
        modelId: "anthropic/claude-sonnet-5",
      },
      WRITING_CATALOG,
      access
    );
    const native = resolveWritingModel(
      { providerId: AgentProvider.Anthropic, modelId: "claude-sonnet-5" },
      WRITING_CATALOG,
      access
    );

    expect(viaGateway.providerId).toBe(AgentProvider.Gateway);
    expect(native.providerId).toBe(AgentProvider.Anthropic);
  });

  it("refuses a gateway model outside the two admitted vendors", () => {
    expect(() =>
      resolveWritingModel(
        {
          providerId: AgentProvider.Gateway,
          modelId: "google/gemini-3.1-pro",
        },
        WRITING_CATALOG,
        HOUSE_ACCESS
      )
    ).toThrow(UnknownAgentModelError);
  });

  /** Whether a model exists never depends on the caller's keys; binding it does. */
  it("resolves a native model without its key, which then cannot be bound", () => {
    const model = resolveWritingModel(
      { providerId: AgentProvider.OpenAI, modelId: "gpt-5.2" },
      WRITING_CATALOG,
      NO_ACCESS
    );

    expect(() => bindModel(model, {}, "off")).toThrow(UnknownAgentModelError);
  });
});

/**
 * `isWritingModel` admits any native id, so this gate checks the catalogue before persist.
 */
describe("assertWritingModel", () => {
  it("accepts a pair that exists in the catalogue", () => {
    expect(() =>
      assertWritingModel(DEFAULT_WRITING_MODEL, WRITING_CATALOG, NO_ACCESS)
    ).not.toThrow();
    expect(() =>
      assertWritingModel(
        { providerId: AgentProvider.OpenAI, modelId: "gpt-5.2" },
        WRITING_CATALOG,
        HOUSE_ACCESS
      )
    ).not.toThrow();
  });

  it("rejects an id policy admits but the catalogue has never heard of", () => {
    expect(() =>
      assertWritingModel(
        { providerId: AgentProvider.OpenAI, modelId: "gpt-does-not-exist" },
        WRITING_CATALOG,
        HOUSE_ACCESS
      )
    ).toThrow(UnknownAgentModelError);
  });

  it("rejects a vendor outside the gateway's admitted set", () => {
    expect(() =>
      assertWritingModel(
        {
          providerId: AgentProvider.Gateway,
          modelId: "google/gemini-3.1-pro",
        },
        WRITING_CATALOG,
        HOUSE_ACCESS
      )
    ).toThrow(UnknownAgentModelError);
  });

  it("accepts a native model even with no key registered", () => {
    expect(() =>
      assertWritingModel(
        { providerId: AgentProvider.Anthropic, modelId: "claude-opus-5" },
        WRITING_CATALOG,
        NO_ACCESS
      )
    ).not.toThrow();
  });
});

describe("listWritingModels", () => {
  it("offers both vendors through the gateway and nothing else from it", () => {
    const gateway = listWritingModels(WRITING_CATALOG, NO_ACCESS).filter(
      (model) => model.providerId === AgentProvider.Gateway
    );
    const usable = gateway.filter((model) => !model.requiresApiKey);

    expect(usable.length).toBeGreaterThan(0);
    expect(
      usable.every(
        (model) =>
          model.modelId.startsWith("anthropic/") ||
          model.modelId.startsWith("openai/")
      )
    ).toBe(true);
    expect(
      gateway
        .filter((model) => model.modelId.startsWith("google/"))
        .every((model) => model.requiresApiKey)
    ).toBe(true);
  });

  it("includes both native providers, flagged until that key is registered", () => {
    const nativeOf = (access = NO_ACCESS) =>
      listWritingModels(WRITING_CATALOG, access).filter(
        (model) => model.providerId !== AgentProvider.Gateway
      );

    expect(new Set(nativeOf().map((model) => model.providerId))).toEqual(
      new Set([AgentProvider.OpenAI, AgentProvider.Anthropic])
    );
    expect(nativeOf().every((model) => model.requiresApiKey)).toBe(true);
    expect(
      nativeOf(accessOf({ anthropic: "sk-test" }))
        .filter((model) => !model.requiresApiKey)
        .map((model) => model.providerId)
    ).toEqual([AgentProvider.Anthropic, AgentProvider.Anthropic]);
  });
});

describe("WRITING_SESSION_DEFAULTS", () => {
  it("defaults a new session to the gateway", () => {
    expect(WRITING_SESSION_DEFAULTS.providerId).toBe(AgentProvider.Gateway);
    expect(isWritingModel(DEFAULT_WRITING_MODEL, NO_ACCESS)).toBe(true);
  });
});
