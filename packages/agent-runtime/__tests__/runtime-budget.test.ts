import { fauxAssistantMessage } from "@earendil-works/pi-ai/providers/faux";
import { describe, expect, it } from "vitest";

import {
  budget,
  build,
  messageOf,
  sleep,
  toolCallTurn,
} from "./runtime.fixture.ts";

describe("runPiTurn budget", () => {
  it("refuses tool calls past the soft budget and the gate never sees them", async () => {
    const fixture = build();
    fixture.faux.setResponses([
      toolCallTurn("search", { q: "0" }, "call-0"),
      toolCallTurn("search", { q: "1" }, "call-1"),
      toolCallTurn("search", { q: "2" }, "call-2"),
      toolCallTurn("publish", { slug: "late" }, "call-3"),
      fauxAssistantMessage("Answering from what I have."),
    ]);

    const result = await fixture.run();

    expect(fixture.context.calls).toEqual(["0", "1", "2"]);
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
    expect(result.status).toBe("done");
  });

  it("ends the turn as budget_exhausted once the model calls through the hard limit", async () => {
    const fixture = build();
    fixture.faux.setResponses([
      ...Array.from({ length: 6 }, (_, index) =>
        toolCallTurn("search", { q: String(index) }, `call-${index}`)
      ),
      fauxAssistantMessage("Still going."),
    ]);

    const result = await fixture.run();

    expect(result).toMatchObject({
      status: "error",
      error: { kind: "budget_exhausted" },
    });
    expect(fixture.context.calls).toEqual(["0", "1", "2"]);
    expect(fixture.events.at(-1)).toEqual({ type: "run:end", reason: "error" });
  });

  it("ends the turn as budget_exhausted when the wall-clock runs out mid-generation", async () => {
    const fixture = build();
    fixture.faux.setResponses([
      toolCallTurn("wait", {}, "call-1"),
      fauxAssistantMessage("Done waiting."),
    ]);

    const result = await fixture.run({
      budget: { ...budget, maxDurationMs: 40 },
    });

    expect(result).toMatchObject({
      status: "error",
      error: {
        kind: "budget_exhausted",
        message: expect.stringMatching(/ran longer than/),
      },
    });
    expect(fixture.events.at(-1)).toEqual({ type: "run:end", reason: "error" });
  });

  it("does not fail a turn whose deadline passes while approvals are being persisted", async () => {
    const fixture = build();
    fixture.faux.setResponses([
      toolCallTurn("publish", {}, "call-1"),
      fauxAssistantMessage("Waiting."),
    ]);
    fixture.persistApprovals.mockImplementation(async () => {
      // The model already stopped; only host work is left when the deadline would fire.
      await sleep(80);
    });

    const result = await fixture.run({
      budget: { ...budget, maxDurationMs: 40 },
    });

    expect(result).toMatchObject({
      status: "awaiting_approval",
      approvals: ["call-1"],
    });
  });

  it("stops listening once the turn is over", async () => {
    const fixture = build();
    const controller = new AbortController();
    fixture.faux.setResponses([fauxAssistantMessage("Done.")]);

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
