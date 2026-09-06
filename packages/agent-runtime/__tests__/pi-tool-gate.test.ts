import { describe, expect, it, vi } from "vitest";

import { createPiToolCallGate } from "../src/pi/tool-gate.ts";
import type { AgentPolicy, ToolCallRequest } from "../src/types.ts";

/**
 * Pins the injected policy: the failure mode of getting it wrong is silent. An unrecognised
 * tool is simply never allowed to run.
 */

const policy = (overrides: Partial<AgentPolicy> = {}): AgentPolicy => ({
  tierOf: (name) => (name.startsWith("write_") ? "write" : "read"),
  labelOf: (name) => name,
  requiresApproval: (tier) => tier === "write",
  summarize: () => "done",
  ...overrides,
});

const call = (
  toolName: string,
  id = "call-1",
  input: Record<string, string> = { some: "arg" }
): ToolCallRequest => ({
  toolCallId: id,
  toolName,
  input,
});

/** The key covers the tool and its target, never the call id: the re-issued call has a new one. */
const keyOf = (request: ToolCallRequest) =>
  `${request.toolName}:${JSON.stringify(request.input)}`;

describe("createPiToolCallGate", () => {
  it("lets a tier through when the policy does not gate it", async () => {
    const gate = createPiToolCallGate({
      policy: policy(),
      autoApprove: [],
      approvalKeyOf: keyOf,
    });

    expect(await gate.handle(call("read_thing"))).toBeUndefined();
    expect(gate.request).toBeUndefined();
  });

  it("blocks a gated tier and records the request under its key", async () => {
    const gate = createPiToolCallGate({
      policy: policy(),
      autoApprove: [],
      approvalKeyOf: keyOf,
    });

    const result = await gate.handle(call("write_thing"));

    expect(result?.block).toBe(true);
    // The reason is fed straight back to the model, so it must tell it to stop rather than
    // retry.
    expect(result?.reason).toMatch(/do not retry/i);
    expect(gate.request).toEqual({
      toolCallId: "call-1",
      toolName: "write_thing",
      tier: "write",
      args: { some: "arg" },
      key: 'write_thing:{"some":"arg"}',
    });
  });

  it("records one request per turn and refuses later gated calls without recording them", async () => {
    const onRequest = vi.fn();
    const gate = createPiToolCallGate({
      policy: policy(),
      autoApprove: [],
      approvalKeyOf: keyOf,
      onRequest,
    });

    await gate.handle(call("write_thing", "call-1"));
    const second = await gate.handle(call("write_other", "call-2"));

    expect(second?.block).toBe(true);
    expect(second?.reason).toMatch(/already waiting/);
    expect(gate.request?.toolCallId).toBe("call-1");
    expect(onRequest).toHaveBeenCalledOnce();
  });

  it("lets a tier through when the session pre-approved it", async () => {
    const gate = createPiToolCallGate({
      policy: policy(),
      autoApprove: ["write"],
      approvalKeyOf: keyOf,
    });

    expect(await gate.handle(call("write_thing"))).toBeUndefined();
    expect(gate.request).toBeUndefined();
  });

  it("spends an approved key on one call, by key rather than call id, and gates the next", async () => {
    const consumeApproval = vi.fn(async () => undefined);
    const gate = createPiToolCallGate({
      policy: policy(),
      autoApprove: [],
      approvalKeyOf: keyOf,
      approvedKeys: new Set(['write_thing:{"some":"arg"}']),
      consumeApproval,
    });

    // A different id for the same tool and arguments: the re-issued call after a decision.
    expect(await gate.handle(call("write_thing", "call-9"))).toBeUndefined();
    expect(consumeApproval).toHaveBeenCalledExactlyOnceWith(
      'write_thing:{"some":"arg"}'
    );

    // Same key again in the same turn: the approval is spent.
    const again = await gate.handle(call("write_thing", "call-10"));
    expect(again?.block).toBe(true);
    expect(gate.request?.toolCallId).toBe("call-10");
  });

  it("does not let an approval through for a different target", async () => {
    const gate = createPiToolCallGate({
      policy: policy(),
      autoApprove: [],
      approvalKeyOf: keyOf,
      approvedKeys: new Set(['write_thing:{"some":"arg"}']),
    });

    const result = await gate.handle(
      call("write_thing", "call-2", { some: "other" })
    );

    expect(result?.block).toBe(true);
    expect(gate.request?.key).toBe('write_thing:{"some":"other"}');
  });

  it("keeps the call blocked, without a new request, when the approval cannot be spent", async () => {
    const gate = createPiToolCallGate({
      policy: policy(),
      autoApprove: [],
      approvalKeyOf: keyOf,
      approvedKeys: new Set(['write_thing:{"some":"arg"}']),
      consumeApproval: async () => {
        throw new Error("database unavailable");
      },
    });

    const result = await gate.handle(call("write_thing"));

    expect(result?.block).toBe(true);
    expect(result?.reason).toMatch(/could not be recorded/);
    expect(gate.request).toBeUndefined();
  });

  it("uses the injected policy rather than any built-in tool table", async () => {
    // A kind that gates nothing at all: every tool runs unsupervised.
    const gate = createPiToolCallGate({
      policy: policy({ requiresApproval: () => false }),
      autoApprove: [],
      approvalKeyOf: keyOf,
    });

    expect(await gate.handle(call("write_thing"))).toBeUndefined();
    expect(gate.request).toBeUndefined();
  });

  it("does not leak one kind's tier names into another's decisions", async () => {
    // `commit` means nothing to this policy; it must not be treated as gated by accident.
    const gate = createPiToolCallGate({
      policy: policy({
        tierOf: () => "commit",
        requiresApproval: (t) => t === "write",
      }),
      autoApprove: [],
      approvalKeyOf: keyOf,
    });

    expect(await gate.handle(call("anything"))).toBeUndefined();
  });
});
