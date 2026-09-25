import { ApprovalVerdict } from "../types.ts";
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

/**
 * What happens to one tool call: it runs, the model reads a refusal instead, or it is held with
 * the rest of its batch for the operator.
 */
export type CallAnswer =
  | { type: "run" }
  | { type: "refuse"; reason: string; declined?: { comment?: string } }
  | { type: "hold" };

export interface ToolCallApprovalsOptions {
  policy: Pick<AgentPolicy, "toolInfo" | "requiresApproval">;
  /** Tiers the session pre-approved; such a call runs without asking. */
  autoApprove: readonly ToolTier[];
  /** What a request is recorded as: the tool, its target and the state the operator is shown. */
  approvalKeyOf: (request: ToolCallRequest) => string | Promise<string>;
  /** The checks every call passes, gated or not, before it runs or reaches the operator. */
  check: (request: ToolCallRequest) => Promise<ToolCallRefusal | undefined>;
  /** The answers a resumed turn brings, and the calls of the reply they answer. */
  resume?: {
    decisions: readonly ApprovalDecision[];
    callIds: ReadonlySet<string>;
  };
}

export interface ToolCallApprovals {
  /**
   * Answers a call of `batch`, its reply's calls in order. The first call asked about triages
   * the batch's gated calls: one the checks refuse is answered with the refusal, one whose tier
   * the session pre-approved runs, and if any is left for the operator the whole batch is held,
   * so none of its calls runs before they answer. Throws what a check or a key throws; once a
   * batch's triage has thrown, every call of that batch throws it too.
   */
  answer: (
    call: ToolCallRequest,
    batch: readonly ToolCallRequest[]
  ) => Promise<CallAnswer>;
  /**
   * What a triaged or answered call was decided as, whether or not the engine asked about it:
   * a call that fails validation is answered by the engine without asking, yet is still held.
   */
  answerOf: (toolCallId: string) => CallAnswer | undefined;
  /** The batch held for the operator, once there is one; the turn stops after it. */
  readonly interrupted: ApprovalBatch | undefined;
}

/** What the model reads for a call it may not run. */
const refusalText = (decision: ApprovalDecision): string =>
  decision.verdict === ApprovalVerdict.Refused
    ? (decision.comment ?? "The call was refused.")
    : decision.comment
      ? `The operator declined this call: ${decision.comment}`
      : "The operator declined this call.";

/** The reply was stopped on before this call was ever put to the operator. */
const UNANSWERED =
  "This call was not put to the operator, so it did not run. Ask again if it is still needed.";

export const createToolCallApprovals = (
  options: ToolCallApprovalsOptions
): ToolCallApprovals => {
  const answers = new Map<string, CallAnswer>();
  const approved = new Set<string>();
  for (const decision of options.resume?.decisions ?? []) {
    if (decision.verdict === ApprovalVerdict.Approved) {
      approved.add(decision.toolCallId);
    } else {
      answers.set(decision.toolCallId, {
        type: "refuse",
        reason: refusalText(decision),
        ...(decision.verdict === ApprovalVerdict.Declined && {
          declined:
            decision.comment === undefined ? {} : { comment: decision.comment },
        }),
      });
    }
  }
  const triages = new Map<string, Promise<void>>();
  let interrupted: ApprovalBatch | undefined;

  const triage = async (batch: readonly ToolCallRequest[]) => {
    const requests: ApprovalRequest[] = [];
    const settled: SettledCall[] = [];
    for (const request of batch) {
      const { tier } = options.policy.toolInfo(request.toolName);
      if (!options.policy.requiresApproval(tier)) continue;
      if (answers.has(request.toolCallId)) continue;
      const operatorApproved = approved.has(request.toolCallId);
      // A resumed reply's gated calls were all answered; one that was not must not be held
      // again, or its batch would wait on a request nobody recorded.
      if (
        !operatorApproved &&
        options.resume?.callIds.has(request.toolCallId)
      ) {
        answers.set(request.toolCallId, { type: "refuse", reason: UNANSWERED });
        continue;
      }
      const refusal = await options.check(request);
      const call = {
        toolCallId: request.toolCallId,
        toolName: request.toolName,
        args: request.input,
        key: await options.approvalKeyOf(request),
      };
      if (refusal) {
        answers.set(request.toolCallId, {
          type: "refuse",
          reason: refusal.reason,
        });
        settled.push({ ...call, approved: false, reason: refusal.reason });
      } else if (operatorApproved) {
        answers.set(request.toolCallId, { type: "run" });
      } else if (options.autoApprove.includes(tier)) {
        answers.set(request.toolCallId, { type: "run" });
        settled.push({ ...call, approved: true });
      } else {
        requests.push({ ...call, tier });
      }
    }
    if (requests.length === 0) return;
    interrupted = { requests, settled };
    for (const request of batch) {
      answers.set(request.toolCallId, { type: "hold" });
    }
  };

  return {
    get interrupted() {
      return interrupted;
    },
    answerOf: (toolCallId) => answers.get(toolCallId),
    answer: async (call, batch) => {
      const batchId = batch[0]?.toolCallId ?? call.toolCallId;
      let triaged = triages.get(batchId);
      if (!triaged) {
        triaged = triage(batch);
        triages.set(batchId, triaged);
      }
      await triaged;
      const known = answers.get(call.toolCallId);
      if (known) return known;
      const refusal = await options.check(call);
      return refusal
        ? { type: "refuse", reason: refusal.reason }
        : { type: "run" };
    },
  };
};
