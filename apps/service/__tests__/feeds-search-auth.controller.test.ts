const { mockFindSession } = vi.hoisted(() => ({
  mockFindSession: vi.fn(),
}));

// Every request presents a session cookie; what it resolves to is the stubbed lookup.
vi.mock("@chia/auth/session", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@chia/auth/session")>()),
  readSessionToken: () => "test-session-token",
}));

vi.mock("@chia/db/repos/auth", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@chia/db/repos/auth")>()),
  findSession: mockFindSession,
}));

import { beforeEach, describe, expect, it, vi } from "vitest";

import * as dbMocks from "@chia/test/mocks/db-feeds";

import { app } from "../src/server";

/** `getAdminId()` under test; any other id is a plain signed-in person. */
const ADMIN_ID = "test-local-admin-id";

const session = (userId: string) => ({
  session: { id: "s1", expiresAt: new Date("2099-01-01") },
  user: {
    id: userId,
    name: userId,
    email: `${userId}@example.com`,
    image: null,
    isAnonymous: false,
  },
});

// Hand-built URL percent-encodes the procedure colon (`%3A`).
const search = (input: Record<string, unknown>) =>
  app.request("/api/v1/rpc/feeds/search%3Aadvanced", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ json: input }),
  });

describe("feeds.search:advanced authentication", () => {
  beforeEach(() => {
    dbMocks.resetAllDbMocks();
    mockFindSession.mockReset();
  });

  it("rejects an anonymous request even for the default hybrid model", async () => {
    mockFindSession.mockResolvedValue(null);

    const res = await search({ keyword: "kubernetes" });

    expect(res.status).toBe(401);
  });

  it("allows a non-root session for the lexical-only model", async () => {
    mockFindSession.mockResolvedValue(session("u1"));

    const res = await search({ keyword: "kubernetes", model: "bm25" });

    expect(res.status).toBe(200);
  });

  /** Omitted `model` defaults to `hybrid`, which embeds; the guard still requires root. */
  it("requires the operator when the model is omitted", async () => {
    mockFindSession.mockResolvedValue(session("u1"));

    const res = await search({ keyword: "kubernetes" });

    expect(res.status).toBe(403);
  });

  it.each(["hybrid", "semantic"])(
    "requires the operator for %s, which spends embedding credentials",
    async (model) => {
      mockFindSession.mockResolvedValue(session("u1"));

      const res = await search({ keyword: "kubernetes", model });

      expect(res.status).toBe(403);
    }
  );

  it("rejects a model that is not a supported mode", async () => {
    mockFindSession.mockResolvedValue(session(ADMIN_ID));

    const res = await search({
      keyword: "kubernetes",
      model: "text-embedding-3-small",
    });

    expect(res.status).toBe(400);
  });
});
