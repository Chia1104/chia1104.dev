import { describe, expect, it } from "vitest";

import {
  AGENT_PROVIDERS,
  UnknownAgentModelError,
  createAgentCatalog,
  createAgentModels,
  listModels,
  resolveModel,
} from "../src/models.ts";
import type { AgentModelRef } from "../src/models.ts";

/**
 * The model layer's job is to keep two things straight: whose key pays, and which provider a
 * model id belongs to. Both fail silently when they go wrong (a turn that quietly bills the
 * house gateway account looks exactly like a working turn), so they are pinned here.
 *
 * These use pi-ai's real providers. Offline-safe: all three ship static catalogues and perform
 * no I/O when registered.
 */

const allowAll = () => true;

const GATEWAY_SONNET: AgentModelRef = {
  providerId: AGENT_PROVIDERS.gateway,
  modelId: "anthropic/claude-sonnet-5",
};

describe("createAgentModels", () => {
  it("registers the gateway with no credentials, because it runs on an ambient env key", () => {
    const models = createAgentModels();

    expect(models.getProvider(AGENT_PROVIDERS.gateway)).toBeDefined();
    expect(
      models.getModel(GATEWAY_SONNET.providerId, GATEWAY_SONNET.modelId)
    ).toBeDefined();
  });

  /**
   * pi-ai falls back to ambient env vars (`OPENAI_API_KEY`, `ANTHROPIC_API_KEY`) when no
   * credential is stored, and a developer shell may well carry them. A provider registered
   * unconditionally would resolve against that key and bill it.
   */
  it("omits a BYOK provider entirely when its key was not supplied", () => {
    const models = createAgentModels();

    expect(models.getProvider(AGENT_PROVIDERS.openai)).toBeUndefined();
    expect(models.getProvider(AGENT_PROVIDERS.anthropic)).toBeUndefined();
  });

  it("registers only the BYOK provider whose key was supplied", () => {
    const models = createAgentModels({ openai: "sk-test" });

    expect(models.getProvider(AGENT_PROVIDERS.openai)).toBeDefined();
    expect(models.getProvider(AGENT_PROVIDERS.anthropic)).toBeUndefined();
  });

  it("resolves a supplied key ahead of the ambient environment", async () => {
    const models = createAgentModels({ anthropic: "sk-supplied" });

    const auth = await models.getAuth(AGENT_PROVIDERS.anthropic);

    expect(auth?.auth.apiKey).toBe("sk-supplied");
  });
});

describe("resolveModel", () => {
  it("resolves a pair the predicate admits", () => {
    const model = resolveModel(GATEWAY_SONNET, allowAll, createAgentModels());

    expect(model.id).toBe(GATEWAY_SONNET.modelId);
    expect(model.contextWindow).toBeGreaterThan(0);
  });

  it("rejects a pair the predicate refuses", () => {
    expect(() =>
      resolveModel(GATEWAY_SONNET, () => false, createAgentModels())
    ).toThrow(UnknownAgentModelError);
  });

  /**
   * The same model carries different ids under different providers. `anthropic/claude-sonnet-5`
   * on the gateway is `claude-sonnet-5` natively. Matching on the id alone would resolve a
   * session to the wrong provider, so a mismatched pair must fail rather than fall back.
   */
  it("rejects a native model id under the gateway", () => {
    expect(() =>
      resolveModel(
        { providerId: AGENT_PROVIDERS.gateway, modelId: "claude-sonnet-5" },
        allowAll,
        createAgentModels()
      )
    ).toThrow(UnknownAgentModelError);
  });

  it("rejects a model on a BYOK provider with no key, naming the provider", () => {
    expect(() =>
      resolveModel(
        { providerId: AGENT_PROVIDERS.openai, modelId: "gpt-5.2" },
        allowAll,
        createAgentModels()
      )
    ).toThrow(/openai/);
  });
});

describe("listModels", () => {
  it("enumerates the catalogue rather than a hand-written list", () => {
    const gateway = listModels(
      (ref) => ref.providerId === AGENT_PROVIDERS.gateway
    );

    // The exact count tracks pi-ai's bundled catalogue; only the order of magnitude is the
    // point.
    expect(gateway.length).toBeGreaterThan(100);
    expect(gateway.every((model) => model.name.length > 0)).toBe(true);
    expect(gateway.every((model) => model.contextWindow > 0)).toBe(true);
  });

  it("applies the predicate per pair", () => {
    const listed = listModels(
      (ref) => ref.modelId === "anthropic/claude-sonnet-5"
    );

    expect(listed).toHaveLength(1);
    expect(listed[0]?.providerId).toBe(AGENT_PROVIDERS.gateway);
  });

  /**
   * The picker lists BYOK models the caller cannot yet use, flagged rather than hidden: hiding
   * them would leave no way to discover that registering a key unlocks them.
   */
  it("flags BYOK models the caller has no key for", () => {
    const listed = listModels(
      (ref) => ref.providerId === AGENT_PROVIDERS.openai,
      { models: createAgentCatalog() }
    );

    expect(listed.length).toBeGreaterThan(0);
    expect(listed.every((model) => model.requiresApiKey)).toBe(true);
  });

  it("clears the flag for a provider the caller has registered", () => {
    const listed = listModels(
      (ref) => ref.providerId === AGENT_PROVIDERS.openai,
      { configured: [AGENT_PROVIDERS.openai] }
    );

    expect(listed.every((model) => model.requiresApiKey)).toBe(false);
  });

  it("never flags the gateway, which needs no caller-supplied key", () => {
    const listed = listModels(
      (ref) => ref.providerId === AGENT_PROVIDERS.gateway
    );

    expect(listed.every((model) => !model.requiresApiKey)).toBe(true);
  });
});
