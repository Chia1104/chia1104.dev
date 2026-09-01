import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AgentModelUsage } from "@chia/agent-runtime/types";
import type { DB } from "@chia/db/client";

type Usage = AgentModelUsage["usage"];

/**
 * The ledger write is where usage is shaped for storage: float-to-micros, no row
 * for an unbilled call, failed writes logged and swallowed.
 */

const { repo } = vi.hoisted(() => ({
  repo: { insertAgentUsage: vi.fn() },
}));

vi.mock("@chia/db/repos/agent/usage", () => repo);

const db = /* SAFETY: the repo is mocked; nothing reads the handle. */ {} as DB;

const usage = (overrides: Partial<Usage> = {}): Usage => ({
  input: 1200,
  output: 300,
  cacheRead: 8000,
  cacheWrite: 0,
  reasoning: 120,
  totalTokens: 9500,
  cost: {
    input: 0.0012,
    output: 0.0015,
    cacheRead: 0.0008,
    cacheWrite: 0,
    total: 0.0035,
  },
  ...overrides,
});

const call = {
  userId: "user-1",
  sessionId: "session-1",
  runId: "run-1",
  entryId: "entry-1",
  kind: "writing",
  source: "turn" as const,
  providerId: "vercel-ai-gateway",
  modelId: "anthropic/claude-haiku-4.5",
};

describe("costToMicros", () => {
  it("rounds dollars to whole micro-dollars", async () => {
    const { costToMicros } = await import("../src/usage");
    expect(costToMicros(0.0035)).toBe(3500);
    expect(costToMicros(0.0000004)).toBe(0);
    expect(costToMicros(1.2345678)).toBe(1234568);
  });

  it.each([Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY])(
    "rejects a non-finite cost",
    async (usd) => {
      const { costToMicros } = await import("../src/usage");
      expect(() => costToMicros(usd)).toThrow(RangeError);
    }
  );

  it("rejects a negative cost", async () => {
    const { costToMicros } = await import("../src/usage");
    expect(() => costToMicros(-0.01)).toThrow(RangeError);
  });

  it("rejects a cost outside the safe integer range", async () => {
    const { costToMicros } = await import("../src/usage");
    expect(() => costToMicros(Number.MAX_SAFE_INTEGER)).toThrow(RangeError);
  });
});

describe("recordAgentUsage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    repo.insertAgentUsage.mockResolvedValue(undefined);
  });

  it("writes the call's breakdown and its cost in micro-dollars", async () => {
    const { recordAgentUsage } = await import("../src/usage");

    await recordAgentUsage(db, { ...call, usage: usage() });

    expect(repo.insertAgentUsage).toHaveBeenCalledExactlyOnceWith(db, {
      userId: "user-1",
      sessionId: "session-1",
      runId: "run-1",
      entryId: "entry-1",
      kind: "writing",
      source: "turn",
      providerId: "vercel-ai-gateway",
      modelId: "anthropic/claude-haiku-4.5",
      input: 1200,
      output: 300,
      cacheRead: 8000,
      cacheWrite: 0,
      reasoning: 120,
      costMicros: 3500,
    });
  });

  it("does not write a call the provider did not bill", async () => {
    const { recordAgentUsage } = await import("../src/usage");

    await recordAgentUsage(db, {
      ...call,
      usage: usage({
        input: 0,
        output: 0,
        cacheRead: 0,
        cacheWrite: 0,
        reasoning: undefined,
        totalTokens: 0,
        cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
      }),
    });

    expect(repo.insertAgentUsage).not.toHaveBeenCalled();
  });

  it("logs and drops an invalid provider cost", async () => {
    const { recordAgentUsage } = await import("../src/usage");
    const error = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    await expect(
      recordAgentUsage(db, {
        ...call,
        usage: usage({
          cost: {
            input: 0,
            output: 0,
            cacheRead: 0,
            cacheWrite: 0,
            total: -0.01,
          },
        }),
      })
    ).resolves.toBeUndefined();

    expect(repo.insertAgentUsage).not.toHaveBeenCalled();
    expect(error).toHaveBeenCalledExactlyOnceWith(
      "Could not record agent usage",
      expect.objectContaining({ userId: "user-1", source: "turn" })
    );
    error.mockRestore();
  });

  it("logs and swallows a failed write", async () => {
    const { recordAgentUsage } = await import("../src/usage");
    const error = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    repo.insertAgentUsage.mockRejectedValue(new Error("connection reset"));

    await expect(
      recordAgentUsage(db, { ...call, usage: usage() })
    ).resolves.toBeUndefined();

    expect(error).toHaveBeenCalledExactlyOnceWith(
      "Could not record agent usage",
      expect.objectContaining({ userId: "user-1", source: "turn" })
    );
    error.mockRestore();
  });
});
