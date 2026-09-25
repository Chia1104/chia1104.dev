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
  assertPublicModel,
  DEFAULT_PUBLIC_MODEL,
  listPublicModels,
  PUBLIC_SESSION_DEFAULTS,
  publicModelPolicy,
  resolvePublicModel,
} from "../src/models.ts";

import { PUBLIC_CATALOG } from "./catalog.fixture.ts";

/**
 * The cost boundary of the public kind. The house pays for a gateway call on its key, so a
 * visitor without a gateway key gets exactly the operator-pinned model. A key of their own
 * opens what that key reaches, on their bill.
 */

const HOUSE = DEFAULT_PUBLIC_MODEL;
const GATEWAY_SONNET = {
  providerId: AgentProvider.Gateway,
  modelId: "anthropic/claude-sonnet-5",
};
const NATIVE_SONNET = {
  providerId: AgentProvider.Anthropic,
  modelId: "claude-sonnet-5",
};
const isPublic = publicModelPolicy(HOUSE);

describe("publicModelPolicy", () => {
  it("admits only the pinned gateway model to a visitor with no gateway key", () => {
    expect(isPublic(HOUSE, NO_ACCESS)).toBe(true);
    expect(isPublic(GATEWAY_SONNET, NO_ACCESS)).toBe(false);
    expect(isPublic(GATEWAY_SONNET, accessOf({ anthropic: "sk" }))).toBe(false);
  });

  it("follows the operator's pin rather than the code default", () => {
    expect(publicModelPolicy(GATEWAY_SONNET)(GATEWAY_SONNET, NO_ACCESS)).toBe(
      true
    );
    expect(publicModelPolicy(GATEWAY_SONNET)(HOUSE, NO_ACCESS)).toBe(false);
  });

  it("opens the whole gateway to a visitor who brought a gateway key", () => {
    expect(isPublic(GATEWAY_SONNET, accessOf({ gateway: "vck" }))).toBe(true);
  });

  it("admits any model on a native provider, which only the visitor's key opens", () => {
    expect(isPublic(NATIVE_SONNET, NO_ACCESS)).toBe(true);
    expect(
      isPublic(
        { providerId: AgentProvider.OpenAI, modelId: "gpt-5.4" },
        NO_ACCESS
      )
    ).toBe(true);
  });

  it("refuses a provider the agent does not know", () => {
    expect(
      isPublic({ providerId: "openrouter", modelId: "gpt-5-mini" }, NO_ACCESS)
    ).toBe(false);
  });
});

describe("resolvePublicModel", () => {
  it("resolves the session default without any caller-supplied key", () => {
    expect(
      resolvePublicModel(HOUSE, PUBLIC_CATALOG, NO_ACCESS, HOUSE)
    ).toMatchObject(HOUSE);
  });

  it("refuses any other gateway model to a visitor without a gateway key", () => {
    expect(() =>
      resolvePublicModel(GATEWAY_SONNET, PUBLIC_CATALOG, NO_ACCESS, HOUSE)
    ).toThrow(UnknownAgentModelError);
  });

  it("runs an expensive gateway model on the visitor's own gateway key", () => {
    const credentials = { gateway: "vck" };
    const model = resolvePublicModel(
      GATEWAY_SONNET,
      PUBLIC_CATALOG,
      accessOf(credentials),
      HOUSE
    );

    expect(model).toMatchObject(GATEWAY_SONNET);
  });

  /** Whether a model exists never depends on the visitor's keys; binding it does. */
  it("resolves a native model without its key, which then cannot be bound", () => {
    const model = resolvePublicModel(
      NATIVE_SONNET,
      PUBLIC_CATALOG,
      NO_ACCESS,
      HOUSE
    );

    expect(model).toMatchObject(NATIVE_SONNET);
    expect(() => bindModel(model, {}, "off")).toThrow(UnknownAgentModelError);
  });
});

describe("assertPublicModel", () => {
  it("accepts the pinned model with no key, any gateway model for the operator, and a native model", () => {
    expect(() =>
      assertPublicModel(HOUSE, PUBLIC_CATALOG, NO_ACCESS, HOUSE)
    ).not.toThrow();
    expect(() =>
      assertPublicModel(GATEWAY_SONNET, PUBLIC_CATALOG, HOUSE_ACCESS, HOUSE)
    ).not.toThrow();
    expect(() =>
      assertPublicModel(NATIVE_SONNET, PUBLIC_CATALOG, NO_ACCESS, HOUSE)
    ).not.toThrow();
  });

  it("rejects a gateway model the visitor's keys do not reach", () => {
    expect(() =>
      assertPublicModel(GATEWAY_SONNET, PUBLIC_CATALOG, NO_ACCESS, HOUSE)
    ).toThrow(UnknownAgentModelError);
  });

  it("rejects an id policy admits but the catalogue has never heard of", () => {
    expect(() =>
      assertPublicModel(
        { providerId: AgentProvider.OpenAI, modelId: "gpt-does-not-exist" },
        PUBLIC_CATALOG,
        HOUSE_ACCESS,
        HOUSE
      )
    ).toThrow(UnknownAgentModelError);
  });
});

describe("listPublicModels", () => {
  it("lists the gateway with only the pinned model usable for a keyless visitor", () => {
    const gateway = listPublicModels(PUBLIC_CATALOG, NO_ACCESS, HOUSE).filter(
      (model) => model.providerId === AgentProvider.Gateway
    );
    const usable = gateway.filter((model) => !model.requiresApiKey);

    expect(gateway.length).toBeGreaterThan(1);
    expect(usable).toHaveLength(1);
    expect(usable[0]).toMatchObject(HOUSE);
  });

  it("marks every gateway model usable with house access, so the operator can pin any of them", () => {
    const gateway = listPublicModels(
      PUBLIC_CATALOG,
      HOUSE_ACCESS,
      HOUSE
    ).filter((model) => model.providerId === AgentProvider.Gateway);

    expect(gateway.length).toBeGreaterThan(1);
    expect(gateway.every((model) => !model.requiresApiKey)).toBe(true);
  });

  it("marks every gateway model usable for a visitor with a gateway key", () => {
    const gateway = listPublicModels(
      PUBLIC_CATALOG,
      accessOf({ gateway: "vck" }),
      HOUSE
    ).filter((model) => model.providerId === AgentProvider.Gateway);

    expect(gateway.every((model) => !model.requiresApiKey)).toBe(true);
  });

  it("includes both native providers, flagged until the visitor registers that key", () => {
    const keyless = listPublicModels(PUBLIC_CATALOG, NO_ACCESS, HOUSE).filter(
      (model) => model.providerId !== AgentProvider.Gateway
    );
    expect(new Set(keyless.map((model) => model.providerId))).toEqual(
      new Set([AgentProvider.OpenAI, AgentProvider.Anthropic])
    );
    expect(keyless.every((model) => model.requiresApiKey)).toBe(true);

    const withOpenAI = listPublicModels(
      PUBLIC_CATALOG,
      accessOf({ openai: "sk" }),
      HOUSE
    );
    expect(
      withOpenAI
        .filter((model) => model.providerId === AgentProvider.OpenAI)
        .every((model) => !model.requiresApiKey)
    ).toBe(true);
    expect(
      withOpenAI
        .filter((model) => model.providerId === AgentProvider.Anthropic)
        .every((model) => model.requiresApiKey)
    ).toBe(true);
  });
});

describe("PUBLIC_SESSION_DEFAULTS", () => {
  it("defaults a new session to the house model", () => {
    expect(PUBLIC_SESSION_DEFAULTS).toMatchObject(HOUSE);
    expect(PUBLIC_SESSION_DEFAULTS.providerId).toBe(AgentProvider.Gateway);
  });
});
