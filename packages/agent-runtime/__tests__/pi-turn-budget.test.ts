import { describe, expect, it, vi } from "vitest";

import type { JsonObject } from "@chia/utils/json";

import { createPiTurnBudget } from "../src/pi/turn-budget.ts";
import type { AgentTurnBudget, ToolCallRequest } from "../src/types.ts";

/**
 * The budget is the only thing that can end a tool-call loop from inside a turn, so each limit
 * is pinned at its exact boundary: one call under must pass, the next must not.
 */

const budget: AgentTurnBudget = {
  maxToolCalls: 4,
  hardMaxToolCalls: 6,
  maxRepeats: 2,
  maxDurationMs: 1000,
};

const call = (
  input: JsonObject,
  toolName = "search",
  id = "call"
): ToolCallRequest => ({ toolCallId: id, toolName, input });

describe("createPiTurnBudget", () => {
  it("lets distinct calls through until the soft limit, then refuses with a finish-now reason", () => {
    const turnBudget = createPiTurnBudget({ budget, onExhausted: vi.fn() });

    for (let index = 0; index < budget.maxToolCalls; index += 1) {
      expect(turnBudget.handle(call({ q: index }))).toBeUndefined();
    }
    const refused = turnBudget.handle(call({ q: "one too many" }));

    expect(refused).toMatchObject({ block: true });
    expect(refused?.reason).toMatch(/do not call any more tools/i);
    expect(turnBudget.toolCalls).toBe(budget.maxToolCalls + 1);
  });

  it("fires onExhausted exactly once, the first time the hard limit is crossed", () => {
    const onExhausted = vi.fn();
    const turnBudget = createPiTurnBudget({ budget, onExhausted });

    for (let index = 0; index < budget.hardMaxToolCalls; index += 1) {
      turnBudget.handle(call({ q: index }));
    }
    expect(onExhausted).not.toHaveBeenCalled();

    expect(turnBudget.handle(call({ q: "over" }))).toMatchObject({
      block: true,
      reason: expect.stringMatching(/stopped/i),
    });
    turnBudget.handle(call({ q: "still over" }));

    expect(onExhausted).toHaveBeenCalledOnce();
  });

  it("refuses the call after maxRepeats identical consecutive calls", () => {
    const turnBudget = createPiTurnBudget({ budget, onExhausted: vi.fn() });

    expect(turnBudget.handle(call({ q: "same" }))).toBeUndefined();
    expect(turnBudget.handle(call({ q: "same" }))).toBeUndefined();
    const refused = turnBudget.handle(call({ q: "same" }));

    expect(refused).toMatchObject({ block: true });
    expect(refused?.reason).toMatch(/same arguments/i);
  });

  it("treats argument key order as irrelevant and nested objects as part of the identity", () => {
    const turnBudget = createPiTurnBudget({ budget, onExhausted: vi.fn() });

    turnBudget.handle(call({ a: 1, b: { c: 2, d: 3 } }));
    turnBudget.handle(call({ b: { d: 3, c: 2 }, a: 1 }));

    expect(turnBudget.handle(call({ a: 1, b: { c: 2, d: 3 } }))).toMatchObject({
      block: true,
    });
    // A differing nested value is a different call.
    expect(
      turnBudget.handle(call({ a: 1, b: { c: 2, d: 4 } }))
    ).toBeUndefined();
  });

  it("resets the repeat count when the tool or its arguments change", () => {
    const turnBudget = createPiTurnBudget({ budget, onExhausted: vi.fn() });

    turnBudget.handle(call({ q: "same" }));
    turnBudget.handle(call({ q: "same" }));
    expect(turnBudget.handle(call({ q: "same" }, "get_post"))).toBeUndefined();
    expect(turnBudget.handle(call({ q: "same" }))).toBeUndefined();
  });

  it.each([
    ["NaN count", { maxToolCalls: Number.NaN }],
    ["infinite count", { hardMaxToolCalls: Number.POSITIVE_INFINITY }],
    ["fractional count", { maxRepeats: 1.5 }],
    ["NaN duration", { maxDurationMs: Number.NaN }],
    ["infinite duration", { maxDurationMs: Number.POSITIVE_INFINITY }],
    ["duration past the timer range", { maxDurationMs: 2 ** 31 }],
  ])("rejects a budget with a %s", (_label, override) => {
    expect(() =>
      createPiTurnBudget({
        budget: { ...budget, ...override },
        onExhausted: vi.fn(),
      })
    ).toThrow();
  });

  it("rejects a budget whose hard limit is below its soft limit", () => {
    expect(() =>
      createPiTurnBudget({
        budget: { ...budget, hardMaxToolCalls: budget.maxToolCalls - 1 },
        onExhausted: vi.fn(),
      })
    ).toThrow(/hardMaxToolCalls/);
  });
});
