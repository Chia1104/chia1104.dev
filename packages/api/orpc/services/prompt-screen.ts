/**
 * Prompt screening port.
 *
 * A kind whose operators are strangers (a public kind) screens their text before it is enqueued;
 * a kind whose only operator is the author does not. The port is a member of the kind's
 * definition in `apps/service`, and the generic kind service calls it inside `prompt()` — this
 * module only names the contract, like `agent.service.ts` beside it, because the oRPC route and
 * the host service must share {@link PromptRejectedError} and `packages/api` is their only
 * common dependency.
 *
 * Screening is not a security boundary — the ports a kind builds for its tools are. A verdict
 * here saves provider spend and keeps abusive text out of a turn, so a screen implementation may
 * fail open; what it must never do is widen what a tool can reach.
 */

export type PromptScreenReason = "injection" | "harmful";

/** One classifier's contribution to a verdict, kept verbatim for the audit trail. */
export interface PromptScreenSignal {
  source: "prompt-guard" | "openai-moderation";
  /** The classifier's own label: `malicious`, `harassment/threatening`, … */
  label: string;
  score: number;
  /** Set when this source failed and the verdict was reached without it. */
  error?: string;
}

export type PromptScreenVerdict =
  | { verdict: "allow"; signals: PromptScreenSignal[] }
  | {
      verdict: "block";
      reason: PromptScreenReason;
      signals: PromptScreenSignal[];
    };

export interface PromptScreenPort {
  screen(
    input: { text: string },
    signal: AbortSignal
  ): Promise<PromptScreenVerdict>;
}

/**
 * Thrown by the kind service's `prompt()` after the verdict is recorded; the chat route maps it
 * onto the contract's `PROMPT_REJECTED`. Only the coarse reason crosses the wire — scores and
 * per-classifier labels stay in `agent.prompt_screen`, where the operator reads them; echoing
 * them to the sender would teach a probing caller how the screen decides.
 */
export class PromptRejectedError extends Error {
  constructor(readonly reason: PromptScreenReason) {
    super(`Prompt rejected: ${reason}`);
    this.name = "PromptRejectedError";
  }
}
