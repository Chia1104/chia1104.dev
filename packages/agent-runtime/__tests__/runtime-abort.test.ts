import { describe, expect, it } from "vitest";

import { defaultApprovalKey } from "../src/turn.ts";

import {
  build,
  messageOf,
  seedOversizedBranch,
  toolCall,
} from "./runtime.fixture.ts";

describe("runTurn abort", () => {
  it("ends an aborted turn without approvals, compaction or an error", async () => {
    const controller = new AbortController();
    const fixture = build([
      toolCall("search", { q: "x" }, "call-1"),
      { hang: true, onRequest: () => controller.abort() },
    ]);
    await seedOversizedBranch(fixture.session);

    await expect(fixture.run({ signal: controller.signal })).resolves.toEqual({
      status: "aborted",
    });
    expect(fixture.persistApprovals).not.toHaveBeenCalled();
    expect((await fixture.branch()).some((e) => e.type === "compaction")).toBe(
      false
    );
    expect(fixture.types()).not.toContain("error");
    expect(fixture.events.at(-1)).toEqual({
      type: "run:end",
      reason: "aborted",
    });
  });

  it("stops mid-generation the moment the host signal fires and persists the partial reply", async () => {
    const fixture = build([{ text: "Half an ans", hang: true }]);
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

    expect(result).toEqual({ status: "aborted" });
    expect(fixture.events.at(-1)).toEqual({
      type: "run:end",
      reason: "aborted",
    });
    const last = messageOf((await fixture.branch()).at(-1));
    expect(last).toMatchObject({
      role: "assistant",
      stopReason: "aborted",
      content: [{ type: "text", text: "Half an ans" }],
    });
  });

  it("skips the provider when the signal fires before the run is armed", async () => {
    const fixture = build([{ text: "Never sent." }]);
    const controller = new AbortController();
    const getBranch = fixture.session.getBranch.bind(fixture.session);
    // The abort lands while the turn is still reading the tree, before any run exists to
    // cancel. The operator's message was accepted before it and stays in the tree.
    fixture.session.getBranch = async (fromId) => {
      controller.abort();
      return getBranch(fromId);
    };

    const result = await fixture.run({ signal: controller.signal });

    expect(result).toEqual({ status: "aborted" });
    expect(fixture.script.requests).toHaveLength(0);
    expect((await getBranch()).map((entry) => messageOf(entry)?.role)).toEqual([
      "user",
    ]);
  });

  it("skips the provider and keeps the message out of the tree when the signal is already aborted", async () => {
    const fixture = build([{ text: "Never sent." }]);
    const controller = new AbortController();
    controller.abort();

    const result = await fixture.run({ signal: controller.signal });

    expect(result).toEqual({ status: "aborted" });
    expect(fixture.script.requests).toHaveLength(0);
    expect(await fixture.branch()).toEqual([]);
  });

  it("does not record approvals or compact when the abort lands after the reply", async () => {
    const fixture = build([toolCall("publish", { slug: "hello" }, "call-1")]);
    await seedOversizedBranch(fixture.session);
    const controller = new AbortController();

    const result = await fixture.run({
      signal: controller.signal,
      // The engine has already stopped on the gated call; the operator stops in the same instant.
      approvalKeyOf: (request) => {
        controller.abort();
        return defaultApprovalKey(request);
      },
    });

    expect(result).toEqual({ status: "aborted" });
    expect(fixture.persistApprovals).not.toHaveBeenCalled();
    expect((await fixture.branch()).some((e) => e.type === "compaction")).toBe(
      false
    );
    // A request is announced only once it is on record.
    expect(fixture.types()).not.toContain("approval:request");
    expect(fixture.events.at(-1)).toEqual({
      type: "run:end",
      reason: "aborted",
    });
  });
});
