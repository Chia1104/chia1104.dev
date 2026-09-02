const { keys, mockGetSession } = vi.hoisted(() => ({
  keys: { public: "", private: "" },
  mockGetSession: vi.fn(),
}));

// The real guard must run; only the session lookup and the signing keys are stubbed.
vi.unmock("../src/guards/auth.guard");

vi.mock("@chia/auth/server", () => ({
  createAuth: () => ({ api: { getSession: mockGetSession } }),
}));

// The setup stub of `ai.guard` drops `providerCookieName`, which the route needs for real.
vi.mock("../src/guards/ai.guard", async (importOriginal) => {
  const original =
    await importOriginal<typeof import("../src/guards/ai.guard")>();
  const mocks = await import("./helpers/guards");
  return { ...original, ai: mocks.ai, AI_AUTH_TOKEN: mocks.AI_AUTH_TOKEN };
});

vi.mock("../src/env", async (importOriginal) => {
  const original = await importOriginal<typeof import("../src/env")>();
  return {
    env: {
      ...original.env,
      get AI_AUTH_PUBLIC_KEY() {
        return keys.public;
      },
      get AI_AUTH_PRIVATE_KEY() {
        return keys.private;
      },
    },
  };
});

import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { generateKeys } from "@chia/ai/utils";

/**
 * A visitor on the public site brings their own provider key as a guest. The cookie is
 * theirs, so `key:signed` admits guests while the rest of `/ai` still needs a person.
 */

let app: (typeof import("../src/server"))["app"];

const guest = {
  session: { id: "guest-session", userId: "guest" },
  user: { id: "guest", role: "user", isAnonymous: true },
};

const signKey = () =>
  app.request("/api/v1/ai/key:signed", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ apiKey: "sk-test", provider: "openai" }),
  });

beforeAll(async () => {
  const generated = generateKeys();
  keys.public = Buffer.from(generated.publicKey, "utf-8").toString("base64");
  keys.private = Buffer.from(generated.privateKey, "utf-8").toString("base64");
  app = (await import("../src/server")).app;
});

describe("POST /ai/key:signed", () => {
  beforeEach(() => {
    mockGetSession.mockReset();
  });

  it("refuses a visitor with no session at all", async () => {
    mockGetSession.mockResolvedValue(null);

    const res = await signKey();

    expect(res.status).toBe(401);
  });

  it("signs a guest's key into their provider cookie", async () => {
    mockGetSession.mockResolvedValue(guest);

    const res = await signKey();

    expect(res.status).toBe(200);
    expect(res.headers.get("set-cookie")).toContain("OPENAI_API_KEY=");
  });

  it("keeps the rest of /ai closed to guests", async () => {
    mockGetSession.mockResolvedValue(guest);

    const res = await app.request("/api/v1/ai/models");

    expect(res.status).toBe(401);
  });
});
