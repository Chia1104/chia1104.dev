import type {
  AgentPolicy,
  ToolCallRefusal,
  ToolCallRequest,
  ToolTier,
} from "../types.ts";

/**
 * Tier-based permission gate, composed into Pi's `beforeToolCall` hook.
 *
 * Pi's hook contract is "return `{ block: true, reason }` to refuse", and the refusal comes
 * back to the model as an error tool result. Used as the approval handshake rather than
 * blocking the harness on a promise: a turn parked on an in-memory deferred cannot survive a
 * deploy, whereas a refused tool call leaves the session tree consistent and resumable. The
 * operator approves, and the next turn re-issues the call with the approval on record.
 *
 * Classification is injected via {@link AgentPolicy}.
 */

export interface ApprovalRequest {
  toolCallId: string;
  toolName: string;
  tier: ToolTier;
  args: unknown;
  /** What an approval of this request is good for; see {@link PiToolCallGateOptions.approvalKeyOf}. */
  key: string;
}

export interface PiToolCallGateOptions {
  policy: AgentPolicy;
  /** Tiers the operator pre-approved for the whole session. */
  autoApprove: readonly ToolTier[];
  /**
   * Identity of a gated call as far as an approval is concerned. An approval granted for one
   * request lets through exactly one later call with the same key, so the key must cover
   * everything the operator decided on: the tool, its target and the state they looked at.
   * The re-issued call carries a new tool call id, which is why the id cannot be the key.
   */
  approvalKeyOf: (request: ToolCallRequest) => string | Promise<string>;
  /** Keys the operator approved that no call has spent yet. */
  approvedKeys?: ReadonlySet<string>;
  /**
   * Spends an approval before its call runs, so a turn that dies after the call cannot spend
   * it again. A rejection keeps the call blocked and the approval unspent.
   */
  consumeApproval?: (key: string) => Promise<void>;
  /**
   * Called the moment a call is refused, before the model has even seen the refusal. Lets the
   * host announce the request while the turn is still streaming; persistence still waits for
   * the turn to finish, so a turn that fails afterwards leaves no durable request behind.
   */
  onRequest?: (request: ApprovalRequest) => void;
}

export interface PiToolCallGate {
  handle: (event: ToolCallRequest) => Promise<ToolCallRefusal | undefined>;
  /**
   * The request this turn raised, if any. One per turn: the workflow parks on exactly one
   * approval hook, so a second gated call is refused without being recorded.
   */
  readonly request: ApprovalRequest | undefined;
}

export const createPiToolCallGate = (
  options: PiToolCallGateOptions
): PiToolCallGate => {
  let request: ApprovalRequest | undefined;
  const approved = new Set(options.approvedKeys);

  return {
    get request() {
      return request;
    },
    async handle(event) {
      const toolName = event.toolName;
      const tier = options.policy.tierOf(toolName);

      if (!options.policy.requiresApproval(tier)) return undefined;
      if (options.autoApprove.includes(tier)) return undefined;

      const key = await options.approvalKeyOf(event);
      if (approved.has(key)) {
        // Spent for this turn whatever happens next: a second identical call must be gated
        // again even when the durable spend below fails.
        approved.delete(key);
        try {
          await options.consumeApproval?.(key);
          return undefined;
        } catch {
          return {
            block: true,
            reason:
              `\`${toolName}\` was approved but the approval could not be recorded as used. ` +
              `Stop here and tell the operator; do not retry this tool.`,
          };
        }
      }

      if (request) {
        return {
          block: true,
          reason:
            `\`${toolName}\` needs human approval, and \`${request.toolName}\` is already waiting for the operator's decision. ` +
            `Only one request can wait at a time. Stop here and summarise what you are about to do; ` +
            `ask for this one after the operator decides.`,
        };
      }

      request = {
        toolCallId: event.toolCallId,
        toolName,
        tier,
        args: event.input,
        key,
      };
      options.onRequest?.(request);

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
