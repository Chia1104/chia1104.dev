import { fauxAssistantMessage } from "@earendil-works/pi-ai/providers/faux";
import { describe, expect, it } from "vitest";

import {
  build,
  messageOf,
  seedOversizedBranch,
  toolCallTurn,
} from "./runtime.fixture.ts";

describe("runPiTurn abort", () => {
  it("ends an aborted turn without approvals, compaction or an error", async () => {
    const fixture = build();
    await seedOversizedBranch(fixture.session);
    const controller = new AbortController();
    fixture.faux.setResponses([
      toolCallTurn("publish", {}, "call-1"),
      () => {
        controller.abort();
        return fauxAssistantMessage("", { stopReason: "aborted" });
      },
    ]);

    await expect(fixture.run({ signal: controller.signal })).resolves.toEqual({
      status: "aborted",
      approvals: [],
      error: undefined,
    });
    expect(fixture.persistApprovals).not.toHaveBeenCalled();
    expect((await fixture.branch()).some((e) => e.type === "compaction")).toBe(
      false
    );
    expect(fixture.events.at(-1)).toEqual({
      type: "run:end",
      reason: "aborted",
    });
  });

  it("stops mid-generation the moment the host signal fires and persists the partial reply", async () => {
    // ~50 tokens at 25 tokens/s: a couple of seconds of streaming, aborted after the first
    // delta.
    const fixture = build({ tokensPerSecond: 25 });
    const text = Array.from(
      { length: 40 },
      (_, i) => `sentence number ${i} of a deliberately long answer.`
    ).join(" ");
    fixture.faux.setResponses([fauxAssistantMessage(text)]);
    const controller = new AbortController();

    let firstDelta: () => void = () => undefined;
    const streamedSomething = new Promise<void>((resolve) => {
      firstDelta = resolve;
    });
    const pending = fixture.run({
      signal: controller.signal,
      onEvent: (event) => {
        fixture.events.push(event);
        if (event.type === "assistant:delta") firstDelta();
      },
    });
    await streamedSomething;
    controller.abort();
    const result = await pending;

    expect(result.status).toBe("aborted");
    expect(fixture.events.at(-1)).toEqual({
      type: "run:end",
      reason: "aborted",
    });
    const last = messageOf((await fixture.branch()).at(-1));
    expect(last?.role).toBe("assistant");
    expect(last?.role === "assistant" ? last.stopReason : undefined).toBe(
      "aborted"
    );
  });

  it("skips the provider when the signal fires before the run is armed", async () => {
    const fixture = build();
    const controller = new AbortController();
    const getBranch = fixture.session.getBranch.bind(fixture.session);
    // The abort lands while the turn is still reading the tree, before any run exists to
    // cancel.
    fixture.session.getBranch = async (fromId) => {
      controller.abort();
      return getBranch(fromId);
    };
    fixture.faux.setResponses([fauxAssistantMessage("Never sent.")]);

    const result = await fixture.run({ signal: controller.signal });

    expect(result.status).toBe("aborted");
    expect(fixture.faux.state.callCount).toBe(0);
    expect(await fixture.branch()).toEqual([]);
  });

  it("skips the provider entirely when the signal is already aborted", async () => {
    const fixture = build();
    const controller = new AbortController();
    controller.abort();
    fixture.faux.setResponses([fauxAssistantMessage("Never sent.")]);

    const result = await fixture.run({ signal: controller.signal });

    expect(fixture.faux.state.callCount).toBe(0);
    expect(result.status).toBe("aborted");
  });

  it("does not persist approvals or compact when the abort lands after the reply", async () => {
    const fixture = build();
    await seedOversizedBranch(fixture.session);
    const controller = new AbortController();
    fixture.faux.setResponses([
      toolCallTurn("publish", {}, "call-1"),
      fauxAssistantMessage("Waiting."),
    ]);

    const result = await fixture.run({
      signal: controller.signal,
      onEvent: (event) => {
        fixture.events.push(event);
        // The provider turn completes normally; the operator stops in the same instant.
        if (event.type === "assistant:end" && event.text === "Waiting.") {
          controller.abort();
        }
      },
    });

    expect(result).toEqual({
      status: "aborted",
      approvals: [],
      error: undefined,
    });
    expect(fixture.persistApprovals).not.toHaveBeenCalled();
    expect((await fixture.branch()).some((e) => e.type === "compaction")).toBe(
      false
    );
    // Announced live when refused; the client retracts it on `run:end{aborted}`.
    expect(fixture.events).toContainEqual(
      expect.objectContaining({
        type: "approval:request",
        toolCallId: "call-1",
      })
    );
    expect(fixture.events.at(-1)).toEqual({
      type: "run:end",
      reason: "aborted",
    });
  });
});
