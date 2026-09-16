import { beforeAll, describe, expect, it } from "vitest";

import { encodeApiKey, generateKeys } from "@chia/ai/utils";

import { readEncryptedAgentCredentials } from "../src/services/agent-credentials.service";

/** Unread ciphertext leaves the session on the house account, quietly. */

let publicKey = "";

beforeAll(() => {
  // `encodeApiKey` takes base64-wrapped PEM, which is how the env var holds it.
  publicKey = Buffer.from(generateKeys().publicKey, "utf-8").toString("base64");
});

const headersWith = (cookie: string) => new Headers({ Cookie: cookie });

describe("readEncryptedAgentCredentials", () => {
  it("lifts each provider's ciphertext out of its cookie", () => {
    const openai = encodeApiKey("sk-openai", publicKey);
    const anthropic = encodeApiKey("sk-anthropic", publicKey);

    const credentials = readEncryptedAgentCredentials(
      headersWith(`OPENAI_API_KEY=${openai}; ANTHROPIC_API_KEY=${anthropic}`)
    );

    expect(credentials).toEqual({ openai, anthropic });
  });

  /** BYOK is optional; a house-gateway session needs no cookies. */
  it("returns undefined when the caller registered nothing", () => {
    expect(readEncryptedAgentCredentials(new Headers())).toBeUndefined();
  });

  it("lifts a gateway key out of its own cookie", () => {
    const gateway = encodeApiKey("vck-gateway", publicKey);

    expect(
      readEncryptedAgentCredentials(
        headersWith(`AI_GATEWAY_API_KEY=${gateway}`)
      )
    ).toEqual({ gateway });
  });

  it("carries only the providers that are actually present", () => {
    const openai = encodeApiKey("sk-openai", publicKey);

    expect(
      readEncryptedAgentCredentials(headersWith(`OPENAI_API_KEY=${openai}`))
    ).toEqual({ openai });
  });

  it("never returns plaintext", () => {
    const openai = encodeApiKey("sk-secret-value", publicKey);

    const credentials = readEncryptedAgentCredentials(
      headersWith(`OPENAI_API_KEY=${openai}`)
    );

    expect(credentials?.openai).not.toContain("sk-secret-value");
  });
});
