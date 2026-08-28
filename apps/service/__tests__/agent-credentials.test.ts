import { beforeAll, describe, expect, it, vi } from "vitest";

import { encodeApiKey, generateKeys } from "@chia/ai/utils";

/**
 * The bring-your-own-key round trip.
 *
 * Worth pinning on its own because both halves fail quietly. A cookie that is read but never
 * decrypted leaves the turn on the house account; a decrypt failure that is swallowed surfaces
 * downstream as "unknown model", which sends the operator looking in entirely the wrong place.
 */

const { keys } = vi.hoisted(() => ({ keys: { public: "", private: "" } }));

vi.mock("../src/env", () => ({
  env: {
    get AI_AUTH_PRIVATE_KEY() {
      return keys.private;
    },
  },
}));

let readEncryptedAgentCredentials: (typeof import("../src/services/agent-credentials.service"))["readEncryptedAgentCredentials"];
let decryptAgentCredentials: (typeof import("../src/services/agent-credentials.service"))["decryptAgentCredentials"];
let AgentCredentialError: (typeof import("../src/services/agent-credentials.service"))["AgentCredentialError"];

beforeAll(async () => {
  const generated = generateKeys();
  // `encodeApiKey`/`decodeApiKey` take base64-wrapped PEM, which is how the env vars hold them.
  keys.public = Buffer.from(generated.publicKey, "utf-8").toString("base64");
  keys.private = Buffer.from(generated.privateKey, "utf-8").toString("base64");

  const module = await import("../src/services/agent-credentials.service");
  readEncryptedAgentCredentials = module.readEncryptedAgentCredentials;
  decryptAgentCredentials = module.decryptAgentCredentials;
  AgentCredentialError = module.AgentCredentialError;
});

const headersWith = (cookie: string) => new Headers({ Cookie: cookie });

describe("readEncryptedAgentCredentials", () => {
  it("lifts each provider's ciphertext out of its cookie", () => {
    const openai = encodeApiKey("sk-openai", keys.public);
    const anthropic = encodeApiKey("sk-anthropic", keys.public);

    const credentials = readEncryptedAgentCredentials(
      headersWith(`OPENAI_API_KEY=${openai}; ANTHROPIC_API_KEY=${anthropic}`)
    );

    expect(credentials).toEqual({ openai, anthropic });
  });

  /**
   * Bring-your-own-key is optional here — a session on the house gateway account needs none — so a
   * request with no cookies is a normal state rather than a rejection.
   */
  it("returns undefined when the caller registered nothing", () => {
    expect(readEncryptedAgentCredentials(new Headers())).toBeUndefined();
  });

  it("carries only the providers that are actually present", () => {
    const openai = encodeApiKey("sk-openai", keys.public);

    expect(
      readEncryptedAgentCredentials(headersWith(`OPENAI_API_KEY=${openai}`))
    ).toEqual({ openai });
  });

  it("never returns plaintext", () => {
    const openai = encodeApiKey("sk-secret-value", keys.public);

    const credentials = readEncryptedAgentCredentials(
      headersWith(`OPENAI_API_KEY=${openai}`)
    );

    expect(credentials?.openai).not.toContain("sk-secret-value");
  });
});

describe("decryptAgentCredentials", () => {
  it("round-trips a key encrypted under the configured public key", () => {
    const encrypted = {
      openai: encodeApiKey("sk-openai", keys.public),
      anthropic: encodeApiKey("sk-anthropic", keys.public),
    };

    expect(decryptAgentCredentials(encrypted)).toEqual({
      openai: "sk-openai",
      anthropic: "sk-anthropic",
    });
  });

  it("treats an absent payload as no bring-your-own key", () => {
    expect(decryptAgentCredentials(undefined)).toEqual({});
  });

  /**
   * Almost always a key encrypted under a rotated keypair. Reported as something the operator can
   * fix, rather than dropped — dropping it would surface as the model not existing.
   */
  it("reports an undecryptable key against its provider", () => {
    expect(() =>
      decryptAgentCredentials({ openai: "not-actually-ciphertext" })
    ).toThrow(AgentCredentialError);
    expect(() =>
      decryptAgentCredentials({ openai: "not-actually-ciphertext" })
    ).toThrow(/openai/);
  });
});
