import type { AgentErrorKind, ToolTier } from "../types.ts";

import type { AgentWireEvent } from "./schema.ts";

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
  /** Epoch ms; unset while an assistant message is still streaming. */
  at?: number;
  streaming: boolean;
  usage?: Extract<AgentWireEvent, { type: "assistant:end" }>["usage"];
}

export interface NoticeView {
  kind: "notice";
  variant: "compacted" | "error" | "decision";
  text: string;
  /** Set on `error` notices. */
  code?: AgentErrorKind;
}

export type AgentViewItem = TextMessageView | ToolCallView | NoticeView;

/** What the operator can do about an error kind; the provider's own text follows it. */
export const AGENT_ERROR_HEADLINE = {
  auth: "The provider rejected the API key",
  quota: "The provider account is out of quota or credit",
  rate_limited: "The provider is rate limiting requests",
  context_overflow:
    "The conversation no longer fits the model's context — compact it",
  provider: "The provider failed",
  internal: "The agent failed",
} satisfies Record<AgentErrorKind, string>;

export const describeAgentError = (error: {
  kind: AgentErrorKind;
  message: string;
}): string => `${AGENT_ERROR_HEADLINE[error.kind]}: ${error.message}`;

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
      if (event.origin === "operator-decision") {
        // Synthesised by the workflow to relay the operator's decision, not typed by them.
        items.push({ kind: "notice", variant: "decision", text: event.text });
        return { ...state, items, runStatus: "running" };
      }
      items.push({
        kind: "user",
        messageId: event.messageId,
        text: event.text,
        at: event.at,
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
      const message =
        /* SAFETY: The producer contract guarantees this value satisfies TextMessageView. */ items[
          index
        ] as TextMessageView;
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
        at: event.at,
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
      // SAFETY: findTool only returns indices for ToolCallView items.
      items[index] = {
        ...(items[index] as ToolCallView),
        summary: event.summary,
      };
      return { ...state, items };
    }

    case "tool:end": {
      const index = findTool(event.toolCallId);
      const existing =
        /* SAFETY: The producer contract guarantees this value satisfies ToolCallView | undefined. */ items[
          index
        ] as ToolCallView | undefined;

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
      // SAFETY: an existing index comes from tool:start; otherwise the fallback creates the view.
      const view: ToolCallView = {
        .../* SAFETY: The producer contract guarantees this value satisfies ToolCallView | undefined. */ ((items[
          index
        ] as ToolCallView | undefined) ?? {
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
        // SAFETY: approval events can only target tool items created by tool:start.
        const existing = items[index] as ToolCallView;
        items[index] = {
          ...existing,
          // The gated call itself never ran — a decision closes the card, and the re-issued call
          // arrives as its own tool item. Leave `awaiting_approval` or a later `tool:end` would
          // read as the gate still holding it.
          status:
            existing.status === "awaiting_approval"
              ? event.approved
                ? "ok"
                : "error"
              : existing.status,
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
      items.push({
        kind: "notice",
        variant: "error",
        text: event.message,
        code: event.kind,
      });
      return { ...state, items, runStatus: "error" };

    case "run:end":
      if (event.reason === "awaiting_approval") {
        return { ...state, items, runStatus: "awaiting_approval" };
      }
      // `approval:request` is announced as soon as the gate refuses, before the turn has proven it
      // can persist the request. A turn that then ends any other way has nothing for the operator
      // to decide — drop the prompts rather than leave cards nobody can act on.
      return {
        ...state,
        items: items.map((item) =>
          item.kind === "tool" && item.status === "awaiting_approval"
            ? { ...item, status: "error" }
            : item
        ),
        pendingApprovals: [],
        runStatus: event.reason === "error" ? "error" : "idle",
      };
  }
};

export const foldEvents = (
  events: readonly AgentWireEvent[],
  initial: AgentViewState = emptyViewState()
): AgentViewState => events.reduce(applyEvent, initial);
