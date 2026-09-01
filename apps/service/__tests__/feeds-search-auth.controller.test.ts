const { mockGetSession } = vi.hoisted(() => ({
  mockGetSession: vi.fn(),
}));

// Uses real `getSession` so the session requirement actually runs.
vi.mock("@chia/auth/server", () => ({
  createAuth: () => ({ api: { getSession: mockGetSession } }),
}));

import { beforeEach, describe, expect, it, vi } from "vitest";
import { app } from "../src/server";

import * as dbMocks from "@chia/test/mocks/db-feeds";

const session = (role: string) => ({
  session: { id: "s1", userId: "u1" },
  user: { id: "u1", role },
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
    mockGetSession.mockReset();
  });

  it("rejects an anonymous request even for the default hybrid model", async () => {
    mockGetSession.mockResolvedValue(null);

    const res = await search({ keyword: "kubernetes" });

    expect(res.status).toBe(401);
  });

  it("allows a non-root session for the lexical-only model", async () => {
    mockGetSession.mockResolvedValue(session("admin"));

    const res = await search({ keyword: "kubernetes", model: "bm25" });

    expect(res.status).toBe(200);
  });

  /** Omitted `model` defaults to `hybrid`, which embeds; the guard still requires root. */
  it("requires Role.Root when the model is omitted", async () => {
    mockGetSession.mockResolvedValue(session("admin"));

    const res = await search({ keyword: "kubernetes" });

    expect(res.status).toBe(403);
  });

  it.each(["hybrid", "semantic"])(
    "requires Role.Root for %s, which spends embedding credentials",
    async (model) => {
      mockGetSession.mockResolvedValue(session("admin"));

      const res = await search({ keyword: "kubernetes", model });

      expect(res.status).toBe(403);
    }
  );

  it("rejects a model that is not a supported mode", async () => {
    mockGetSession.mockResolvedValue(session("root"));

    const res = await search({
      keyword: "kubernetes",
      model: "text-embedding-3-small",
    });

    expect(res.status).toBe(400);
  });
});
