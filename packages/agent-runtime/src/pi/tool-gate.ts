import type {
  ToolCallEvent,
  ToolCallResult,
} from "@earendil-works/pi-agent-core";

import type { AgentPolicy, ToolTier } from "../types.ts";

/**
 * Tier-based permission gate, installed as pi's `tool_call` hook.
 *
 * pi's hook contract is "return `{ block: true, reason }` to refuse", and the refusal comes back to
 * the model as an error tool result. That is deliberately used as the approval handshake rather than
 * blocking the harness on a promise: a turn parked on an in-memory deferred cannot survive a
 * deploy, whereas a *refused* tool call leaves the session tree consistent and resumable — the
 * operator approves, and the next turn re-issues the call with the approval on record.
 *
 * Classification is **injected** via {@link AgentPolicy}. It used to be a module-level lookup table
 * of the writing agent's tool names, which meant a second agent kind's tools all fell through to the
 * most restrictive tier and were silently blocked forever.
 */

export interface ApprovalRequest {
  toolCallId: string;
  toolName: string;
  tier: ToolTier;
  args: unknown;
}

export interface PiToolCallGateOptions {
  policy: AgentPolicy;
  /** Tiers the operator pre-approved for the whole session. */
  autoApprove: readonly ToolTier[];
  /**
   * Tool call ids already approved. Populated from `agent_tool_approval` when a turn is resumed
   * after a decision, so the re-issued call goes through.
   */
  approvedToolCallIds?: ReadonlySet<string>;
  /**
   * Tool names pre-authorised for this turn only — the "run and commit" affordance, which lets the
   * common path avoid burning a turn on the refusal handshake.
   */
  preAuthorizedToolNames?: ReadonlySet<string>;
  /** Called for each refusal so the transport can surface an approval prompt. */
  onApprovalRequired: (request: ApprovalRequest) => void;
}

export interface PiToolCallGate {
  handle: (event: ToolCallEvent) => ToolCallResult | undefined;
  /** Requests raised during the turn, in order. Drives `run:end{awaiting_approval}`. */
  readonly requests: readonly ApprovalRequest[];
}

export const createPiToolCallGate = (
  options: PiToolCallGateOptions
): PiToolCallGate => {
  const requests: ApprovalRequest[] = [];
  const approved = options.approvedToolCallIds ?? new Set<string>();
  const preAuthorized = options.preAuthorizedToolNames ?? new Set<string>();

  return {
    requests,
    handle(event) {
      const toolName = event.toolName;
      const tier = options.policy.tierOf(toolName);

      if (!options.policy.requiresApproval(tier)) return undefined;

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
          `\`${toolName}\` needs human approval before it can run. ` +
          `The request has been sent to the operator. Stop here and summarise what you are about to do — ` +
          `do not retry this tool and do not look for another route to the same effect.`,
      };
    },
  };
};
