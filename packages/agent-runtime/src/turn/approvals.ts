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

/**
 * One reply's calls, in order, as the checks see them. A batch is identified by the object, not
 * by its call ids: a later reply may reuse an id, and must not inherit what an earlier one got.
 */
export interface ToolCallBatch {
  calls: readonly ToolCallRequest[];
  /** The stopped reply a resumed turn replays; only its calls carry the operator's answers. */
  replayed: boolean;
}

export interface ToolCallApprovalsOptions {
  policy: Pick<AgentPolicy, "toolInfo" | "requiresApproval">;
  /** Tiers the session pre-approved; such a call runs without asking. */
  autoApprove: readonly ToolTier[];
  /** What a request is recorded as: the tool, its target and the state the operator is shown. */
  approvalKeyOf: (request: ToolCallRequest) => string | Promise<string>;
  /** The checks every call passes, gated or not, before it runs or reaches the operator. */
  check: (request: ToolCallRequest) => Promise<ToolCallRefusal | undefined>;
  /** The answers a resumed turn brings for the calls of its replayed batch. */
  decisions?: readonly ApprovalDecision[];
}

export interface ToolCallApprovals {
  /**
   * Answers the batch's gated calls, once per batch: the replayed batch's by the operator's
   * decisions; otherwise one the checks refuse is answered with the refusal, one whose tier the
   * session pre-approved runs, and if any is left for the operator the whole batch is held, so
   * none of its calls runs before they answer. Throws what a check or a key throws, and throws
   * it again for the same batch.
   */
  triage: (batch: ToolCallBatch) => Promise<void>;
  /** Answers a call of `batch`, triaging the batch first if it was not. */
  answer: (call: ToolCallRequest, batch: ToolCallBatch) => Promise<CallAnswer>;
  /**
   * What a call of a triaged batch was decided as, whether or not the engine asked about it: a
   * call that fails validation is answered by the engine without asking, yet is still held.
   */
  answerOf: (
    batch: ToolCallBatch,
    toolCallId: string
  ) => CallAnswer | undefined;
  /** The batch held for the operator, once there is one; the turn stops after it. */
  readonly interrupted: ApprovalBatch | undefined;
}

/** What the model reads for a call the operator or the checks answered with a refusal. */
const refusalOf = (decision: ApprovalDecision): CallAnswer => {
  if (decision.verdict === ApprovalVerdict.Refused) {
    return {
      type: "refuse",
      reason: decision.comment ?? "The call was refused.",
    };
  }
  return {
    type: "refuse",
    reason: decision.comment
      ? `The operator declined this call: ${decision.comment}`
      : "The operator declined this call.",
    declined:
      decision.comment === undefined ? {} : { comment: decision.comment },
  };
};

/** The reply was stopped on before this call was ever put to the operator. */
const UNANSWERED: CallAnswer = {
  type: "refuse",
  reason:
    "This call was not put to the operator, so it did not run. Ask again if it is still needed.",
};

export const createToolCallApprovals = (
  options: ToolCallApprovalsOptions
): ToolCallApprovals => {
  const decisions = new Map(
    (options.decisions ?? []).map((decision) => [decision.toolCallId, decision])
  );
  const triages = new WeakMap<
    ToolCallBatch,
    { answers: Map<string, CallAnswer>; done: Promise<void> }
  >();
  let interrupted: ApprovalBatch | undefined;

  const triage = async (
    batch: ToolCallBatch,
    answers: Map<string, CallAnswer>
  ) => {
    const requests: ApprovalRequest[] = [];
    const settled: SettledCall[] = [];
    for (const request of batch.calls) {
      const { tier } = options.policy.toolInfo(request.toolName);
      if (!options.policy.requiresApproval(tier)) continue;
      const decision = batch.replayed
        ? decisions.get(request.toolCallId)
        : undefined;
      // A replayed batch's gated calls were all answered; one that was not must not be held
      // again, or its batch would wait on a request nobody recorded.
      if (batch.replayed && decision?.verdict !== ApprovalVerdict.Approved) {
        answers.set(
          request.toolCallId,
          decision ? refusalOf(decision) : UNANSWERED
        );
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
      } else if (decision) {
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
    for (const request of batch.calls) {
      answers.set(request.toolCallId, { type: "hold" });
    }
  };

  const triageOf = (batch: ToolCallBatch) => {
    let triaged = triages.get(batch);
    if (!triaged) {
      const answers = new Map<string, CallAnswer>();
      triaged = { answers, done: triage(batch, answers) };
      triages.set(batch, triaged);
    }
    return triaged;
  };

  return {
    get interrupted() {
      return interrupted;
    },
    answerOf: (batch, toolCallId) =>
      triages.get(batch)?.answers.get(toolCallId),
    triage: async (batch) => {
      await triageOf(batch).done;
    },
    answer: async (call, batch) => {
      const triaged = triageOf(batch);
      await triaged.done;
      const known = triaged.answers.get(call.toolCallId);
      if (known) return known;
      const refusal = await options.check(call);
      return refusal
        ? { type: "refuse", reason: refusal.reason }
        : { type: "run" };
    },
  };
};
