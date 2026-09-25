import { describe, expect, it, vi } from "vitest";

import type { AssistantMessage } from "../src/messages.ts";
import type { MessageEntry } from "../src/session/entries.ts";
import {
  openCallsOf,
  resumeItemOf,
  settledDecision,
  triageInterrupt,
} from "../src/turn/interrupt.ts";
import type { ToolCallRequest } from "../src/types.ts";

import { assistantMessage } from "./runtime.fixture.ts";

const request = (toolCallId: string, toolName: string): ToolCallRequest => ({
  toolCallId,
  toolName,
  input: { id: toolCallId },
});

const policy = {
  toolInfo: (name: string) => ({
    label: name,
    tier: name === "commit" ? "commit" : "draft",
  }),
};

describe("triageInterrupt", () => {
  it("settles refused and pre-approved calls and leaves the rest to the operator", async () => {
    const check = vi.fn((call: ToolCallRequest) =>
      Promise.resolve(
        call.toolCallId === "c1" ? { reason: "Empty draft." } : undefined
      )
    );

    const batch = await triageInterrupt(
      [
        request("c1", "commit"),
        request("c2", "write"),
        request("c3", "commit"),
      ],
      {
        check,
        approvalKeyOf: (call) => `key:${call.toolCallId}`,
        policy,
        autoApprove: ["draft"],
      }
    );

    expect(batch).toEqual({
      settled: [
        {
          toolCallId: "c1",
          toolName: "commit",
          args: { id: "c1" },
          key: "key:c1",
          approved: false,
          reason: "Empty draft.",
        },
        {
          toolCallId: "c2",
          toolName: "write",
          args: { id: "c2" },
          key: "key:c2",
          approved: true,
        },
      ],
      requests: [
        {
          toolCallId: "c3",
          toolName: "commit",
          args: { id: "c3" },
          key: "key:c3",
          tier: "commit",
        },
      ],
    });
    expect(check).toHaveBeenCalledTimes(3);
  });

  it("throws what a check throws", async () => {
    await expect(
      triageInterrupt([request("c1", "commit")], {
        check: () => Promise.reject(new Error("preflight broke")),
        approvalKeyOf: () => "key",
        policy,
        autoApprove: [],
      })
    ).rejects.toThrow("preflight broke");
  });
});

describe("resumeItemOf", () => {
  it("tells the model who declined a call and why", () => {
    expect(
      resumeItemOf({ toolCallId: "c1", approved: false, comment: "Not yet." })
    ).toEqual({
      interruptId: "approval_c1",
      status: "resolved",
      payload: {
        approved: false,
        payload: { error: "The operator declined this call: Not yet." },
      },
    });
    expect(
      resumeItemOf(
        settledDecision({
          toolCallId: "c2",
          toolName: "commit",
          args: {},
          key: "k",
          approved: false,
          reason: "Empty draft.",
        })
      ).payload
    ).toEqual({ approved: false, payload: { error: "Empty draft." } });
    expect(resumeItemOf({ toolCallId: "c3", approved: true }).payload).toEqual({
      approved: true,
    });
  });
});

describe("openCallsOf", () => {
  const entry = (
    id: string,
    message: MessageEntry["message"],
    seq: number
  ): MessageEntry => ({
    type: "message",
    id,
    parentId: null,
    seq,
    timestamp: message.timestamp,
    message,
  });
  const withCalls = (...ids: string[]): AssistantMessage => ({
    ...assistantMessage("", 1),
    content: ids.map((id) => ({
      type: "toolCall" as const,
      id,
      name: "commit",
      arguments: {},
    })),
  });

  it("returns the last reply's calls that have no result yet", () => {
    expect(
      openCallsOf([
        entry("a1", withCalls("c1", "c2"), 1),
        entry(
          "t1",
          {
            role: "toolResult",
            toolCallId: "c1",
            toolName: "commit",
            content: [{ type: "text", text: "ok" }],
            isError: false,
            timestamp: 2,
          },
          2
        ),
      ])
    ).toEqual(new Set(["c2"]));
  });

  it("is empty when the branch ends on the operator", () => {
    expect(
      openCallsOf([
        entry("a1", withCalls("c1"), 1),
        entry("u1", { role: "user", content: "Stop.", timestamp: 2 }, 2),
      ])
    ).toEqual(new Set());
  });
});
