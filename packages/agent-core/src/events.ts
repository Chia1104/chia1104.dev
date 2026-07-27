import type {
  AgentHarnessEvent,
  SessionTreeEntry,
} from "@earendil-works/pi-agent-core";
import * as z from "zod";

import type { ToolTier } from "./types.ts";

/**
 * The wire event contract between the harness and any client.
 *
 * pi's `AgentHarnessEvent` is **not** safe to forward: it carries whole `Model` objects,
 * `partial` assistant snapshots on every delta, and unbounded tool `details`. This module
 * is the single narrowing point — `toWireEvents` maps pi events down to the fields a UI
 * needs, and `foldEvents` folds either a live stream *or* a replayed transcript into the
 * same view model, so there is exactly one rendering path.
 */

// ============================================
// Wire event schema
// ============================================

const usageSchema = z.object({
  input: z.number(),
  output: z.number(),
  cacheRead: z.number().optional(),
  cacheWrite: z.number().optional(),
  costTotal: z.number().optional(),
});

export const agentWireEventSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("run:start"), sessionId: z.string() }),
  z.object({
    type: z.literal("user"),
    messageId: z.string(),
    text: z.string(),
  }),
  z.object({ type: z.literal("assistant:start"), messageId: z.string() }),
  z.object({
    type: z.literal("assistant:delta"),
    messageId: z.string(),
    channel: z.enum(["text", "thinking"]),
    delta: z.string(),
  }),
  z.object({
    type: z.literal("assistant:end"),
    messageId: z.string(),
    text: z.string(),
    thinking: z.string().optional(),
    usage: usageSchema.optional(),
    stopReason: z.string().optional(),
  }),
  z.object({
    type: z.literal("tool:start"),
    toolCallId: z.string(),
    toolName: z.string(),
    label: z.string(),
    tier: z.string(),
    args: z.unknown(),
  }),
  z.object({
    type: z.literal("tool:update"),
    toolCallId: z.string(),
    summary: z.string(),
  }),
  z.object({
    type: z.literal("tool:end"),
    toolCallId: z.string(),
    toolName: z.string(),
    isError: z.boolean(),
    summary: z.string(),
    /** Per-tool view model. Shape is the tool's `details`, narrowed by the tool itself. */
    details: z.unknown().optional(),
  }),
  z.object({
    type: z.literal("approval:request"),
    toolCallId: z.string(),
    toolName: z.string(),
    tier: z.string(),
    args: z.unknown(),
  }),
  z.object({
    type: z.literal("approval:resolved"),
    toolCallId: z.string(),
    approved: z.boolean(),
    comment: z.string().optional(),
  }),
  z.object({
    type: z.literal("session:compacted"),
    summary: z.string(),
    tokensBefore: z.number(),
  }),
  z.object({
    type: z.literal("state:changed"),
    /**
     * What changed, as named by the agent kind's policy (`"draft"` for the writing agent).
     * Bump-only — the client refetches rather than diffing over the wire.
     */
    scope: z.string().optional(),
    revision: z.number(),
  }),
  z.object({ type: z.literal("error"), message: z.string() }),
  z.object({
    type: z.literal("run:end"),
    reason: z.enum(["done", "aborted", "error", "awaiting_approval"]),
  }),
]);

export type AgentWireEvent = z.infer<typeof agentWireEventSchema>;

// ============================================
// pi event → wire event
// ============================================

/**
 * pi's assistant messages carry no id, so the mapper assigns one per assistant message and
 * accumulates text/thinking to emit a single terminal `assistant:end`. That means the
 * mapper is **stateful per turn** — create one per run, never share.
 */
export interface EventMapperOptions {
  /** Tier lookup so the UI can style a tool call before its result arrives. */
  tierOf: (toolName: string) => ToolTier;
  labelOf: (toolName: string) => string;
  /** Condenses a tool result into one line for the transcript. */
  summarize: (toolName: string, result: unknown, isError: boolean) => string;
}

export const createEventMapper = (options: EventMapperOptions) => {
  let assistantSeq = 0;
  let current: { id: string; text: string; thinking: string } | undefined;

  return (event: AgentHarnessEvent): AgentWireEvent[] => {
    switch (event.type) {
      case "message_start": {
        if (event.message.role !== "assistant") return [];
        assistantSeq += 1;
        current = { id: `a${assistantSeq}`, text: "", thinking: "" };
        return [{ type: "assistant:start", messageId: current.id }];
      }

      case "message_update": {
        if (!current) return [];
        const inner = event.assistantMessageEvent;
        if (inner.type === "text_delta") {
          current.text += inner.delta;
          return [
            {
              type: "assistant:delta",
              messageId: current.id,
              channel: "text",
              delta: inner.delta,
            },
          ];
        }
        if (inner.type === "thinking_delta") {
          current.thinking += inner.delta;
          return [
            {
              type: "assistant:delta",
              messageId: current.id,
              channel: "thinking",
              delta: inner.delta,
            },
          ];
        }
        return [];
      }

      case "message_end": {
        if (event.message.role !== "assistant" || !current) return [];
        const message = event.message;
        const done = current;
        current = undefined;
        return [
          {
            type: "assistant:end",
            messageId: done.id,
            text: done.text,
            thinking: done.thinking || undefined,
            stopReason: message.stopReason,
            usage: message.usage
              ? {
                  input: message.usage.input,
                  output: message.usage.output,
                  cacheRead: message.usage.cacheRead,
                  cacheWrite: message.usage.cacheWrite,
                  costTotal: message.usage.cost?.total,
                }
              : undefined,
          },
        ];
      }

      case "tool_execution_start":
        return [
          {
            type: "tool:start",
            toolCallId: event.toolCallId,
            toolName: event.toolName,
            label: options.labelOf(event.toolName),
            tier: options.tierOf(event.toolName),
            args: event.args,
          },
        ];

      case "tool_execution_end":
        return [
          {
            type: "tool:end",
            toolCallId: event.toolCallId,
            toolName: event.toolName,
            isError: event.isError,
            summary: options.summarize(
              event.toolName,
              event.result,
              event.isError
            ),
            details: (event.result as { details?: unknown } | undefined)
              ?.details,
          },
        ];

      case "session_compact":
        return [
          {
            type: "session:compacted",
            summary: event.compactionEntry.summary,
            tokensBefore: event.compactionEntry.tokensBefore,
          },
        ];

      default:
        return [];
    }
  };
};

// ============================================
// Transcript replay: session entries → wire events
// ============================================

/**
 * Rebuilds wire events from a persisted branch so a reconnecting client renders through
 * exactly the same fold as the live stream. Deltas are not replayed — a completed message
 * arrives as a single `assistant:end`.
 */
export const entriesToWireEvents = (
  entries: readonly SessionTreeEntry[],
  options: Pick<EventMapperOptions, "tierOf" | "labelOf" | "summarize">
): AgentWireEvent[] => {
  const events: AgentWireEvent[] = [];
  let assistantSeq = 0;

  for (const entry of entries) {
    if (entry.type === "compaction") {
      events.push({
        type: "session:compacted",
        summary: entry.summary,
        tokensBefore: entry.tokensBefore,
      });
      continue;
    }
    if (entry.type !== "message") continue;
    const message = entry.message;

    if (message.role === "user") {
      events.push({
        type: "user",
        messageId: entry.id,
        text: contentToText(message.content),
      });
      continue;
    }

    if (message.role === "assistant") {
      assistantSeq += 1;
      const messageId = `a${assistantSeq}`;
      const text = message.content
        .filter((part) => part.type === "text")
        .map((part) => part.text)
        .join("");
      const thinking = message.content
        .filter((part) => part.type === "thinking")
        .map((part) => part.thinking)
        .join("");

      events.push({
        type: "assistant:end",
        messageId,
        text,
        thinking: thinking || undefined,
        stopReason: message.stopReason,
        usage: message.usage
          ? {
              input: message.usage.input,
              output: message.usage.output,
              cacheRead: message.usage.cacheRead,
              cacheWrite: message.usage.cacheWrite,
              costTotal: message.usage.cost?.total,
            }
          : undefined,
      });

      for (const part of message.content) {
        if (part.type !== "toolCall") continue;
        events.push({
          type: "tool:start",
          toolCallId: part.id,
          toolName: part.name,
          label: options.labelOf(part.name),
          tier: options.tierOf(part.name),
          args: part.arguments,
        });
      }
      continue;
    }

    if (message.role === "toolResult") {
      events.push({
        type: "tool:end",
        toolCallId: message.toolCallId,
        toolName: message.toolName,
        isError: message.isError,
        summary: options.summarize(message.toolName, message, message.isError),
        details: message.details,
      });
    }
  }

  return events;
};

const contentToText = (
  content: string | readonly { type: string; text?: string }[]
): string =>
  typeof content === "string"
    ? content
    : content
        .filter((part) => part.type === "text")
        .map((part) => part.text ?? "")
        .join("");

// ============================================
// Fold: wire events → view model
// ============================================

export interface ToolCallView {
  kind: "tool";
  toolCallId: string;
  toolName: string;
  label: string;
  tier: ToolTier;
  args: unknown;
  status: "running" | "ok" | "error" | "awaiting_approval";
  summary?: string;
  details?: unknown;
  approval?: { approved: boolean; comment?: string };
}

export interface TextMessageView {
  kind: "user" | "assistant";
  messageId: string;
  text: string;
  thinking?: string;
  streaming: boolean;
  usage?: z.infer<typeof usageSchema>;
}

export interface NoticeView {
  kind: "notice";
  variant: "compacted" | "error";
  text: string;
}

export type AgentViewItem = TextMessageView | ToolCallView | NoticeView;

export interface AgentViewState {
  items: AgentViewItem[];
  /** Tool calls parked on a human decision. Drives the approval prompt. */
  pendingApprovals: ToolCallView[];
  /** Bumped whenever a tool changed durable state the client should refetch. */
  stateRevision: number;
  runStatus: "idle" | "running" | "awaiting_approval" | "error";
}

export const emptyViewState = (): AgentViewState => ({
  items: [],
  pendingApprovals: [],
  stateRevision: 0,
  runStatus: "idle",
});

/**
 * Pure reducer. Applying the same events in the same order always yields the same state,
 * which is what lets the replayed transcript and the live stream share a renderer.
 */
export const applyEvent = (
  state: AgentViewState,
  event: AgentWireEvent
): AgentViewState => {
  const items = state.items.slice();
  const findTool = (toolCallId: string) =>
    items.findIndex(
      (item) => item.kind === "tool" && item.toolCallId === toolCallId
    );

  switch (event.type) {
    case "run:start":
      return { ...state, items, runStatus: "running" };

    case "user":
      items.push({
        kind: "user",
        messageId: event.messageId,
        text: event.text,
        streaming: false,
      });
      return { ...state, items, runStatus: "running" };

    case "assistant:start":
      items.push({
        kind: "assistant",
        messageId: event.messageId,
        text: "",
        streaming: true,
      });
      return { ...state, items, runStatus: "running" };

    case "assistant:delta": {
      const index = items.findIndex(
        (item) =>
          item.kind === "assistant" && item.messageId === event.messageId
      );
      if (index === -1) return { ...state, items };
      const message = items[index] as TextMessageView;
      items[index] =
        event.channel === "text"
          ? { ...message, text: message.text + event.delta }
          : { ...message, thinking: (message.thinking ?? "") + event.delta };
      return { ...state, items };
    }

    case "assistant:end": {
      const index = items.findIndex(
        (item) =>
          item.kind === "assistant" && item.messageId === event.messageId
      );
      const view: TextMessageView = {
        kind: "assistant",
        messageId: event.messageId,
        text: event.text,
        thinking: event.thinking,
        usage: event.usage,
        streaming: false,
      };
      if (index === -1) items.push(view);
      else items[index] = view;
      return { ...state, items };
    }

    case "tool:start":
      items.push({
        kind: "tool",
        toolCallId: event.toolCallId,
        toolName: event.toolName,
        label: event.label,
        tier: event.tier,
        args: event.args,
        status: "running",
      });
      return { ...state, items };

    case "tool:update": {
      const index = findTool(event.toolCallId);
      if (index === -1) return { ...state, items };
      items[index] = {
        ...(items[index] as ToolCallView),
        summary: event.summary,
      };
      return { ...state, items };
    }

    case "tool:end": {
      const index = findTool(event.toolCallId);
      const existing = items[index] as ToolCallView | undefined;

      /**
       * A gated call still produces a `tool:end`: the permission gate refuses it, and pi turns
       * the refusal into an error tool result. That result is the gate working, not a failure —
       * so a call already parked on `awaiting_approval` keeps that status and stays in
       * `pendingApprovals`, otherwise the approval prompt would vanish the instant it appeared.
       */
      const blockedPendingApproval = existing?.status === "awaiting_approval";

      const next: ToolCallView = {
        ...(existing ?? {
          kind: "tool",
          toolCallId: event.toolCallId,
          toolName: event.toolName,
          label: event.toolName,
          tier: "read",
          args: undefined,
          status: "running",
        }),
        status: blockedPendingApproval
          ? "awaiting_approval"
          : event.isError
            ? "error"
            : "ok",
        summary: blockedPendingApproval ? existing.summary : event.summary,
        details: blockedPendingApproval ? existing.details : event.details,
      };
      if (index === -1) items.push(next);
      else items[index] = next;

      if (blockedPendingApproval) return { ...state, items };

      return {
        ...state,
        items,
        pendingApprovals: state.pendingApprovals.filter(
          (pending) => pending.toolCallId !== event.toolCallId
        ),
      };
    }

    case "approval:request": {
      const index = findTool(event.toolCallId);
      const view: ToolCallView = {
        ...((items[index] as ToolCallView | undefined) ?? {
          kind: "tool",
          toolCallId: event.toolCallId,
          toolName: event.toolName,
          label: event.toolName,
          tier: event.tier,
          args: event.args,
          status: "running",
        }),
        status: "awaiting_approval",
      };
      if (index === -1) items.push(view);
      else items[index] = view;
      return {
        ...state,
        items,
        pendingApprovals: [...state.pendingApprovals, view],
        runStatus: "awaiting_approval",
      };
    }

    case "approval:resolved": {
      const index = findTool(event.toolCallId);
      if (index !== -1) {
        items[index] = {
          ...(items[index] as ToolCallView),
          approval: { approved: event.approved, comment: event.comment },
        };
      }
      return {
        ...state,
        items,
        pendingApprovals: state.pendingApprovals.filter(
          (pending) => pending.toolCallId !== event.toolCallId
        ),
        runStatus: "running",
      };
    }

    case "session:compacted":
      items.push({
        kind: "notice",
        variant: "compacted",
        text: event.summary,
      });
      return { ...state, items };

    case "state:changed":
      return { ...state, items, stateRevision: event.revision };

    case "error":
      items.push({ kind: "notice", variant: "error", text: event.message });
      return { ...state, items, runStatus: "error" };

    case "run:end":
      return {
        ...state,
        items,
        runStatus:
          event.reason === "awaiting_approval"
            ? "awaiting_approval"
            : event.reason === "error"
              ? "error"
              : "idle",
      };
  }
};

export const foldEvents = (
  events: readonly AgentWireEvent[],
  initial: AgentViewState = emptyViewState()
): AgentViewState => events.reduce(applyEvent, initial);
