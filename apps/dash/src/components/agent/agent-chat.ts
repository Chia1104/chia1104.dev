import type { UIMessage } from "@tanstack/ai-react";

import type { AgentWireEvent, ToolCallView } from "@chia/agent-runtime/events";
import { describeAgentError, foldEvents } from "@chia/agent-runtime/events";

export interface PendingApproval {
  toolCallId: string;
  toolName: string;
  args?: unknown;
}

export interface ApprovalContinuation {
  approvalId: string;
  approved: boolean;
}

const jsonOf = (value: unknown): string => {
  try {
    return JSON.stringify(value) ?? "";
  } catch {
    return String(value);
  }
};

const toolState = (
  status: ToolCallView["status"]
): "approval-requested" | "complete" | "error" | "input-complete" => {
  if (status === "awaiting_approval") return "approval-requested";
  if (status === "ok") return "complete";
  if (status === "error") return "error";
  return "input-complete";
};

const toolMessage = (
  tool: Pick<
    ToolCallView,
    "args" | "details" | "status" | "summary" | "toolCallId" | "toolName"
  >,
  index: number
): UIMessage => {
  const state = toolState(tool.status);
  const output =
    tool.details === undefined && tool.summary === undefined
      ? undefined
      : { summary: tool.summary, details: tool.details };

  return {
    id: `history:tool-message:${index}:${tool.toolCallId}`,
    role: "assistant",
    parts: [
      {
        type: "tool-call",
        id: `history:tool-call:${index}:${tool.toolCallId}`,
        name: tool.toolName,
        arguments: jsonOf(tool.args),
        input: tool.args,
        state,
        ...(state === "approval-requested"
          ? {
              approval: {
                id: tool.toolCallId,
                needsApproval: true,
              },
            }
          : {}),
        ...(output === undefined ? {} : { output }),
      },
    ],
  };
};

/**
 * Hydrates TanStack's client state from the server-owned transcript.
 *
 * The durable session remains authoritative; this conversion is only the initial UI projection.
 * Live updates arrive as AG-UI chunks after the first prompt/approval request.
 */
export const agentEventsToUiMessages = (
  events: readonly AgentWireEvent[],
  serverApprovals: readonly PendingApproval[] = []
): UIMessage[] => {
  const view = foldEvents(events);
  const messages: UIMessage[] = [];
  const knownToolCallIds = new Set<string>();

  for (const [index, item] of view.items.entries()) {
    if (item.kind === "tool") {
      knownToolCallIds.add(item.toolCallId);
      messages.push(toolMessage(item, index));
      continue;
    }

    if (item.kind === "notice") {
      messages.push({
        id: `history:notice:${index}`,
        role: "assistant",
        parts: [
          {
            type: "text",
            content: item.code
              ? describeAgentError({ kind: item.code, message: item.text })
              : item.text,
          },
        ],
      });
      continue;
    }

    messages.push({
      id: `history:${index}:${item.messageId}`,
      role: item.kind,
      parts: [
        ...(item.thinking
          ? [{ type: "thinking" as const, content: item.thinking }]
          : []),
        { type: "text", content: item.text },
      ],
    });
  }

  for (const approval of serverApprovals) {
    if (knownToolCallIds.has(approval.toolCallId)) continue;
    messages.push(
      toolMessage(
        {
          toolCallId: approval.toolCallId,
          toolName: approval.toolName,
          args: approval.args,
          details: undefined,
          status: "awaiting_approval",
          summary: undefined,
        },
        messages.length
      )
    );
  }

  return messages;
};

export const latestUserText = (
  messages: readonly UIMessage[]
): string | undefined => {
  const message = messages.findLast((item) => item.role === "user");
  if (!message) return undefined;
  const text = message.parts
    .filter((part) => part.type === "text")
    .map((part) => part.content)
    .join("")
    .trim();
  return text || undefined;
};

export const nextApprovalContinuation = (
  messages: readonly UIMessage[],
  handledApprovalIds: ReadonlySet<string>
): ApprovalContinuation | undefined => {
  for (const message of messages.toReversed()) {
    for (const part of message.parts.toReversed()) {
      if (
        part.type !== "tool-call" ||
        part.state !== "approval-responded" ||
        !part.approval ||
        part.approval.approved === undefined ||
        handledApprovalIds.has(part.approval.id)
      ) {
        continue;
      }
      return {
        approvalId: part.approval.id,
        approved: part.approval.approved,
      };
    }
  }
  return undefined;
};

export const mergePendingApprovals = (
  serverApprovals: readonly PendingApproval[],
  messages: readonly UIMessage[]
): PendingApproval[] => {
  const approvalStates = new Map<string, PendingApproval | null>();

  for (const message of messages) {
    for (const part of message.parts) {
      if (part.type !== "tool-call" || !part.approval) continue;
      approvalStates.set(
        part.approval.id,
        part.state === "approval-requested"
          ? {
              toolCallId: part.approval.id,
              toolName: part.name,
              args: part.input,
            }
          : null
      );
    }
  }

  const pending = new Map<string, PendingApproval>();
  for (const approval of serverApprovals) {
    if (approvalStates.get(approval.toolCallId) !== null) {
      pending.set(approval.toolCallId, approval);
    }
  }
  for (const [approvalId, approval] of approvalStates) {
    if (approval) pending.set(approvalId, approval);
  }
  return [...pending.values()];
};

/** Cancels the oRPC event iterator when TanStack stops or supersedes a request. */
export const withAbortSignal = async function* <T>(
  iterable: AsyncIterable<T>,
  signal: AbortSignal
): AsyncGenerator<T, void, void> {
  const iterator = iterable[Symbol.asyncIterator]();
  const abort = () => {
    void iterator.return?.();
  };
  signal.addEventListener("abort", abort, { once: true });

  try {
    if (signal.aborted) return;
    while (!signal.aborted) {
      const next = await iterator.next();
      if (next.done) return;
      yield next.value;
    }
  } finally {
    signal.removeEventListener("abort", abort);
    await iterator.return?.();
  }
};
