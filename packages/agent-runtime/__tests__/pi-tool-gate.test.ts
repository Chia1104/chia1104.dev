import type { ToolCallEvent } from "@earendil-works/pi-agent-core";
import { describe, expect, it, vi } from "vitest";

import { createPiToolCallGate } from "../src/pi/tool-gate.ts";
import type { AgentPolicy } from "../src/types.ts";

/**
 * The gate is the seam that used to be a module-level table of the writing agent's tool names.
 * These tests pin the injected behaviour, because the failure mode of getting it wrong is silent:
 * an unrecognised tool is simply never allowed to run.
 */

const policy = (overrides: Partial<AgentPolicy> = {}): AgentPolicy => ({
  tierOf: (name) => (name.startsWith("write_") ? "write" : "read"),
  labelOf: (name) => name,
  requiresApproval: (tier) => tier === "write",
  summarize: () => "done",
  ...overrides,
});

const call = (toolName: string, id = "call-1"): ToolCallEvent => ({
  type: "tool_call",
  toolCallId: id,
  toolName,
  input: { some: "arg" },
});

describe("createPiToolCallGate", () => {
  it("lets a tier through when the policy does not gate it", () => {
    const onApprovalRequired = vi.fn();
    const gate = createPiToolCallGate({
      policy: policy(),
      autoApprove: [],
      onApprovalRequired,
    });

    expect(gate.handle(call("read_thing"))).toBeUndefined();
    expect(onApprovalRequired).not.toHaveBeenCalled();
    expect(gate.requests).toHaveLength(0);
  });

  it("blocks a gated tier and records the request", () => {
    const onApprovalRequired = vi.fn();
    const gate = createPiToolCallGate({
      policy: policy(),
      autoApprove: [],
      onApprovalRequired,
    });

    const result = gate.handle(call("write_thing"));

    expect(result?.block).toBe(true);
    // The reason is fed straight back to the model, so it must tell it to stop rather than retry.
    expect(result?.reason).toMatch(/do not retry/i);
    expect(gate.requests).toEqual([
      {
        toolCallId: "call-1",
        toolName: "write_thing",
        tier: "write",
        args: { some: "arg" },
      },
    ]);
    expect(onApprovalRequired).toHaveBeenCalledOnce();
  });

  it("honours each of the three ways a gated call may proceed", () => {
    const cases: {
      name: string;
      options: Partial<Parameters<typeof createPiToolCallGate>[0]>;
    }[] = [
      {
        name: "tier pre-approved for the session",
        options: { autoApprove: ["write"] },
      },
      {
        name: "this exact call already decided",
        options: { approvedToolCallIds: new Set(["call-1"]) },
      },
      {
        name: "tool pre-authorised for this turn",
        options: { preAuthorizedToolNames: new Set(["write_thing"]) },
      },
    ];

    for (const { name, options } of cases) {
      const gate = createPiToolCallGate({
        policy: policy(),
        autoApprove: [],
        onApprovalRequired: () => undefined,
        ...options,
      });
      expect(gate.handle(call("write_thing")), name).toBeUndefined();
      expect(gate.requests, name).toHaveLength(0);
    }
  });

  it("uses the injected policy rather than any built-in tool table", () => {
    // A kind that gates nothing at all: every tool runs unsupervised. Impossible to express when
    // classification was a module-level singleton keyed on the writing agent's tool names.
    const gate = createPiToolCallGate({
      policy: policy({ requiresApproval: () => false }),
      autoApprove: [],
      onApprovalRequired: () => undefined,
    });

    expect(gate.handle(call("write_thing"))).toBeUndefined();
    expect(gate.requests).toHaveLength(0);
  });

  it("does not leak one kind's tier names into another's decisions", () => {
    // `commit` means nothing to this policy; it must not be treated as gated by accident.
    const gate = createPiToolCallGate({
      policy: policy({
        tierOf: () => "commit",
        requiresApproval: (t) => t === "write",
      }),
      autoApprove: [],
      onApprovalRequired: () => undefined,
    });

    expect(gate.handle(call("anything"))).toBeUndefined();
  });
});
