import type { UIMessage } from "@tanstack/ai-react";

import type { AgentWireEvent } from "@chia/agent-core";

import {
  agentEventsToUiMessages,
  latestUserText,
  mergePendingApprovals,
  nextApprovalContinuation,
} from "@/components/agent/agent-chat";

describe("agent chat adapter", () => {
  it("hydrates text, thinking, and pending tools from the durable transcript", () => {
    const events = [
      {
        type: "user",
        messageId: "u1",
        text: "Draft a post",
      },
      { type: "assistant:start", messageId: "a1" },
      {
        type: "assistant:end",
        messageId: "a1",
        text: "I will prepare it.",
        thinking: "Plan first",
      },
      {
        type: "tool:start",
        toolCallId: "call-1",
        toolName: "commit",
        label: "Commit",
        tier: "commit",
        args: { title: "Post" },
      },
      {
        type: "approval:request",
        toolCallId: "call-1",
        toolName: "commit",
        tier: "commit",
        args: { title: "Post" },
      },
    ] satisfies AgentWireEvent[];

    const messages = agentEventsToUiMessages(events);
    expect(messages[0]).toMatchObject({
      role: "user",
      parts: [{ type: "text", content: "Draft a post" }],
    });
    expect(messages[1]).toMatchObject({
      role: "assistant",
      parts: [
        { type: "thinking", content: "Plan first" },
        { type: "text", content: "I will prepare it." },
      ],
    });
    expect(messages[2]?.parts[0]).toMatchObject({
      type: "tool-call",
      name: "commit",
      state: "approval-requested",
      approval: { id: "call-1", needsApproval: true },
    });
  });

  it("turns a TanStack approval response into one backend continuation", () => {
    const messages = [
      {
        id: "assistant-1",
        role: "assistant",
        parts: [
          {
            type: "tool-call",
            id: "ui-call-1",
            name: "commit",
            arguments: "{}",
            state: "approval-responded",
            approval: {
              id: "call-1",
              needsApproval: true,
              approved: true,
            },
          },
        ],
      },
    ] satisfies UIMessage[];

    expect(nextApprovalContinuation(messages, new Set())).toEqual({
      approvalId: "call-1",
      approved: true,
    });
    expect(nextApprovalContinuation(messages, new Set(["call-1"]))).toBe(
      undefined
    );
  });

  it("uses only the latest user text and hides locally resolved server approvals", () => {
    const messages = [
      {
        id: "user-1",
        role: "user",
        parts: [{ type: "text", content: "First" }],
      },
      {
        id: "user-2",
        role: "user",
        parts: [{ type: "text", content: "Second" }],
      },
      {
        id: "assistant-1",
        role: "assistant",
        parts: [
          {
            type: "tool-call",
            id: "ui-call-1",
            name: "commit",
            arguments: "{}",
            state: "approval-responded",
            approval: {
              id: "call-1",
              needsApproval: true,
              approved: false,
            },
          },
        ],
      },
    ] satisfies UIMessage[];

    expect(latestUserText(messages)).toBe("Second");
    expect(
      mergePendingApprovals(
        [{ toolCallId: "call-1", toolName: "commit" }],
        messages
      )
    ).toEqual([]);
  });
});
