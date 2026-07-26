import type {
  ToolCallEvent,
  ToolCallResult,
} from "@earendil-works/pi-agent-core";

import { TOOL_TIER_BY_NAME } from "./tools/registry.ts";
import type { ToolTier } from "./types.ts";

/**
 * Tier-based permission gate, installed as pi's `tool_call` hook.
 *
 * pi's hook contract is "return `{ block: true, reason }` to refuse", and the refusal comes
 * back to the model as an error tool result. That is deliberately used as the approval
 * handshake rather than blocking the harness on a promise: a turn that is parked on an
 * in-memory deferred cannot survive a deploy, whereas a *refused* tool call leaves the
 * session tree in a consistent, resumable state — the operator approves, and the next turn
 * re-issues the call with the approval recorded.
 */

export const tierOf = (toolName: string): ToolTier =>
  TOOL_TIER_BY_NAME[toolName] ?? "commit";

export interface ApprovalRequest {
  toolCallId: string;
  toolName: string;
  tier: ToolTier;
  args: unknown;
}

export interface ToolCallGateOptions {
  /** Tiers the operator pre-approved for the whole session. */
  autoApprove: readonly ToolTier[];
  /**
   * Tool call ids already approved. Populated from `agent_tool_approval` when a turn is
   * resumed after a decision, so the re-issued call goes through.
   */
  approvedToolCallIds?: ReadonlySet<string>;
  /**
   * Tool names pre-authorised for this turn only — the "執行並提交" affordance, which lets
   * the common path avoid burning a turn on the refusal handshake.
   */
  preAuthorizedToolNames?: ReadonlySet<string>;
  /** Called for each refusal so the transport can surface an approval prompt. */
  onApprovalRequired: (request: ApprovalRequest) => void;
}

export interface ToolCallGate {
  handle: (event: ToolCallEvent) => ToolCallResult | undefined;
  /** Requests raised during the turn, in order. Drives `run:end{awaiting_approval}`. */
  readonly requests: readonly ApprovalRequest[];
}

export const createToolCallGate = (
  options: ToolCallGateOptions
): ToolCallGate => {
  const requests: ApprovalRequest[] = [];
  const approved = options.approvedToolCallIds ?? new Set<string>();
  const preAuthorized = options.preAuthorizedToolNames ?? new Set<string>();

  return {
    requests,
    handle(event) {
      const toolName = event.toolName;
      const tier = tierOf(toolName);

      // `read` and `draft` never touch published data — no gate.
      if (tier !== "commit") return undefined;

      if (
        options.autoApprove.includes(tier) ||
        approved.has(event.toolCallId) ||
        preAuthorized.has(toolName)
      ) {
        return undefined;
      }

      const request: ApprovalRequest = {
        toolCallId: event.toolCallId,
        toolName,
        tier,
        args: event.input,
      };
      requests.push(request);
      options.onApprovalRequired(request);

      return {
        block: true,
        // Phrased for the model: it must stop and wait, not retry or work around the gate.
        reason:
          `\`${toolName}\` writes to the live blog and needs human approval. ` +
          `The request has been sent to the operator. Stop here and summarise what you are about to commit — ` +
          `do not retry this tool and do not attempt another way to publish.`,
      };
    },
  };
};
