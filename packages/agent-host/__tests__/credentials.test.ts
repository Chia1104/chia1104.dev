import { beforeAll, describe, expect, it } from "vitest";

import { encodeApiKey, generateKeys } from "@chia/ai/utils";

import {
  AgentCredentialError,
  decryptAgentCredentials,
} from "../src/credentials";

const keys = { public: "", private: "" };

beforeAll(() => {
  const generated = generateKeys();
  // `encodeApiKey`/`decodeApiKey` take base64-wrapped PEM, which is how the env vars hold them.
  keys.public = Buffer.from(generated.publicKey, "utf-8").toString("base64");
  keys.private = Buffer.from(generated.privateKey, "utf-8").toString("base64");
});

describe("decryptAgentCredentials", () => {
  it("round-trips a key encrypted under the configured public key", () => {
    const encrypted = {
      openai: encodeApiKey("sk-openai", keys.public),
      anthropic: encodeApiKey("sk-anthropic", keys.public),
    };

    expect(decryptAgentCredentials(encrypted, keys.private)).toEqual({
      openai: "sk-openai",
      anthropic: "sk-anthropic",
    });
  });

  it("treats an absent payload as no bring-your-own key", () => {
    expect(decryptAgentCredentials(undefined, keys.private)).toEqual({});
  });

  /** Usually a rotated keypair; dropping it would look like the model does not exist. */
  it("reports an undecryptable key against its provider", () => {
    expect(() =>
      decryptAgentCredentials(
        { openai: "not-actually-ciphertext" },
        keys.private
      )
    ).toThrow(AgentCredentialError);
    expect(() =>
      decryptAgentCredentials(
        { openai: "not-actually-ciphertext" },
        keys.private
      )
    ).toThrow(/openai/);
  });
});
