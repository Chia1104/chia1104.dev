import type { RunAgentResumeItem } from "@tanstack/ai";

import type { ToolCallContent } from "../messages.ts";
import type { SessionEntry } from "../session/entries.ts";
import type {
  AgentPolicy,
  ApprovalBatch,
  ApprovalDecision,
  ApprovalRequest,
  SettledCall,
  ToolCallRefusal,
  ToolCallRequest,
  ToolTier,
} from "../types.ts";

/** The id the engine gives the approval interrupt of a gated call. */
const approvalInterruptId = (toolCallId: string) => `approval_${toolCallId}`;

/** What the model reads for a call it may not run. */
const refusalText = (decision: ApprovalDecision): string =>
  decision.refused
    ? (decision.comment ?? "The call was refused.")
    : decision.comment
      ? `The operator declined this call: ${decision.comment}`
      : "The operator declined this call.";

/** One answered call as the engine's resume takes it. */
export const resumeItemOf = (
  decision: ApprovalDecision
): RunAgentResumeItem => ({
  interruptId: approvalInterruptId(decision.toolCallId),
  status: "resolved",
  payload: decision.approved
    ? { approved: true }
    : { approved: false, payload: { error: refusalText(decision) } },
});

/** A call the turn settled itself, answered as its own checks decided. */
export const settledDecision = (call: SettledCall): ApprovalDecision => ({
  toolCallId: call.toolCallId,
  approved: call.approved,
  comment: call.reason,
  refused: true,
});

export interface InterruptTriage {
  /** The checks every call passes, gated or not; a refusal settles the call as rejected. */
  check: (request: ToolCallRequest) => Promise<ToolCallRefusal | undefined>;
  approvalKeyOf: (request: ToolCallRequest) => string | Promise<string>;
  policy: Pick<AgentPolicy, "toolInfo">;
  /** Tiers the session pre-approved; such a call is settled as approved. */
  autoApprove: readonly ToolTier[];
}

/**
 * Sorts the gated calls an interrupt stopped on. A call the turn's own checks refuse would fail
 * anyway and never reaches the operator, a call whose tier the session pre-approved runs without
 * asking, and the rest wait for the operator. Throws what a check or a key throws.
 */
export const triageInterrupt = async (
  calls: readonly ToolCallRequest[],
  triage: InterruptTriage
): Promise<ApprovalBatch> => {
  const requests: ApprovalRequest[] = [];
  const settled: SettledCall[] = [];
  for (const request of calls) {
    const { tier } = triage.policy.toolInfo(request.toolName);
    const refusal = await triage.check(request);
    const answered = {
      toolCallId: request.toolCallId,
      toolName: request.toolName,
      args: request.input,
      key: await triage.approvalKeyOf(request),
    };
    if (refusal) {
      settled.push({ ...answered, approved: false, reason: refusal.reason });
    } else if (triage.autoApprove.includes(tier)) {
      settled.push({ ...answered, approved: true });
    } else {
      requests.push({ ...answered, tier });
    }
  }
  return { requests, settled };
};

/** Every tool call the branch's replies made, by id. */
export const callsOf = (
  branch: readonly SessionEntry[]
): Map<string, ToolCallContent> =>
  new Map(
    branch.flatMap((entry) =>
      entry.type === "message" && entry.message.role === "assistant"
        ? entry.message.content.flatMap((part) =>
            part.type === "toolCall" ? [[part.id, part] as const] : []
          )
        : []
    )
  );

/** The calls of the branch's last reply that have no result yet: what a resume answers. */
export const openCallsOf = (branch: readonly SessionEntry[]): Set<string> => {
  const answered = new Set<string>();
  for (let index = branch.length - 1; index >= 0; index -= 1) {
    const entry = branch[index];
    if (entry?.type !== "message") break;
    if (entry.message.role === "toolResult") {
      answered.add(entry.message.toolCallId);
      continue;
    }
    if (entry.message.role !== "assistant") break;
    return new Set(
      entry.message.content.flatMap((part) =>
        part.type === "toolCall" && !answered.has(part.id) ? [part.id] : []
      )
    );
  }
  return new Set();
};
