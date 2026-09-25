import { describe, expect, it } from "vitest";

import { AgentErrorKind } from "../src/types.ts";

import {
  budget,
  build,
  messageOf,
  sleep,
  toolCall,
} from "./runtime.fixture.ts";

describe("runTurn budget", () => {
  it("refuses tool calls past the soft budget before any reach the operator", async () => {
    const fixture = build([
      toolCall("search", { q: "0" }, "call-0"),
      toolCall("search", { q: "1" }, "call-1"),
      toolCall("search", { q: "2" }, "call-2"),
      toolCall("publish", { slug: "late" }, "call-3"),
      { text: "Answering from what I have." },
    ]);

    const result = await fixture.run();

    expect(fixture.calls).toEqual(["0", "1", "2"]);
    const toolResults = (await fixture.branch())
      .map(messageOf)
      .filter((message) => message?.role === "toolResult");
    expect(toolResults.map((message) => message?.isError)).toEqual([
      false,
      false,
      false,
      true,
    ]);
    expect(JSON.stringify(toolResults[3]?.content)).toMatch(/budget/i);
    // The fourth call was a gated `publish`; the budget refused it first, so no approval
    // exists.
    expect(fixture.persistApprovals).not.toHaveBeenCalled();
    expect(fixture.types()).not.toContain("approval:request");
    expect(result).toEqual({ status: "done" });
  });

  it("ends the turn as budget_exhausted once the model calls through the hard limit", async () => {
    const fixture = build([
      ...Array.from({ length: 4 }, (_, index) =>
        toolCall("search", { q: String(index) }, `call-${index}`)
      ),
      { text: "Still going." },
    ]);

    const result = await fixture.run({
      budget: { ...budget, maxToolCalls: 2, hardMaxToolCalls: 3 },
    });

    expect(result).toMatchObject({
      status: "error",
      error: { kind: AgentErrorKind.BudgetExhausted },
    });
    expect(fixture.calls).toEqual(["0", "1"]);
    expect(fixture.events.slice(-2)).toEqual([
      { type: "error", kind: AgentErrorKind.BudgetExhausted },
      { type: "run:end", reason: "error" },
    ]);
  });

  it("ends the turn as budget_exhausted when one reply batches calls through the hard limit", async () => {
    const fixture = build([
      {
        toolCalls: Array.from({ length: 6 }, (_, index) => ({
          id: `call-${index}`,
          name: "search",
          args: { q: String(index) },
        })),
      },
      { text: "Still going." },
    ]);

    const result = await fixture.run();

    expect(result).toMatchObject({
      status: "error",
      error: { kind: AgentErrorKind.BudgetExhausted },
    });
    expect(fixture.calls).toEqual(["0", "1", "2"]);
  });

  /** The budget and the deadline are the only bounds on a turn whose model keeps calling tools. */
  it("keeps calling the model while the budget allows, however many replies that takes", async () => {
    const fixture = build([
      ...Array.from({ length: 6 }, (_, index) =>
        toolCall("search", { q: String(index) }, `call-${index}`)
      ),
      { text: "Found everything." },
    ]);

    const result = await fixture.run({
      budget: { ...budget, maxToolCalls: 10, hardMaxToolCalls: 12 },
    });

    expect(result).toEqual({ status: "done" });
    expect(fixture.calls).toEqual(["0", "1", "2", "3", "4", "5"]);
    expect(messageOf((await fixture.branch()).at(-1))).toMatchObject({
      role: "assistant",
      content: [{ type: "text", text: "Found everything." }],
    });
  });

  it("ends the turn as budget_exhausted when the wall-clock runs out mid-tool", async () => {
    const fixture = build([
      toolCall("wait", {}, "call-1"),
      { text: "Done waiting." },
    ]);

    const result = await fixture.run({
      budget: { ...budget, maxDurationMs: 40 },
    });

    expect(result).toMatchObject({
      status: "error",
      error: {
        kind: AgentErrorKind.BudgetExhausted,
        message: expect.stringMatching(/ran longer than/),
      },
    });
    expect(fixture.events.at(-1)).toEqual({ type: "run:end", reason: "error" });
  });

  it("ends the turn as budget_exhausted when the wall-clock runs out mid-generation", async () => {
    const fixture = build([{ text: "Thinking out lo", hang: true }]);

    const result = await fixture.run({
      budget: { ...budget, maxDurationMs: 40 },
    });

    expect(result).toMatchObject({
      status: "error",
      error: {
        kind: AgentErrorKind.BudgetExhausted,
        message: expect.stringMatching(/ran longer than/),
      },
    });
    // The partial reply is kept, closed as stopped rather than failed.
    const last = messageOf((await fixture.branch()).at(-1));
    expect(last).toMatchObject({ role: "assistant", stopReason: "aborted" });
  });

  it("does not fail a turn whose deadline passes while approvals are being recorded", async () => {
    const fixture = build([toolCall("publish", {}, "call-1")]);
    fixture.persistApprovals.mockImplementation(async () => {
      // The model already stopped; only host work is left when the deadline would fire.
      await sleep(80);
    });

    const result = await fixture.run({
      budget: { ...budget, maxDurationMs: 40 },
    });

    expect(result).toMatchObject({
      status: "awaiting_approval",
      approvals: [expect.objectContaining({ toolCallId: "call-1" })],
    });
  });

  it("stops listening once the turn is over", async () => {
    const fixture = build([{ text: "Done." }]);
    const controller = new AbortController();

    const result = await fixture.run({
      signal: controller.signal,
      budget: { ...budget, maxDurationMs: 40 },
    });
    const count = fixture.events.length;
    controller.abort();
    await sleep(60);

    expect(result.status).toBe("done");
    expect(fixture.events).toHaveLength(count);
  });
});
