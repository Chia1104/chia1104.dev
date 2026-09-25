import { AgentErrorKind } from "../types.ts";
import type { AgentTurnError } from "../types.ts";

/** A failure the host raised, and what threw; the cause is logged beside it, never sent. */
export interface TurnFailure {
  error: AgentTurnError;
  cause?: unknown;
}

/**
 * The turn's abort, deadline and host failure.
 *
 * The engine turns a throwing hook into a tool error or a provider error, indistinguishable from
 * the real thing, so hooks record their own failures here and the turn fails once the run has
 * unwound.
 */
export interface TurnControl {
  /** Fires on the host's abort, the first host failure or the deadline; the engine runs on it. */
  readonly controller: AbortController;
  /** The host aborted the turn. */
  readonly aborted: boolean;
  /** The first failure the host raised. */
  readonly failure: TurnFailure | undefined;
  fail: (error: AgentTurnError, cause?: unknown) => void;
  /**
   * Stops the deadline. It bounds the model's generation only, so it can never fail a turn whose
   * model has already stopped; the approval bookkeeping and compaction that follow are host work.
   */
  endGeneration: () => void;
  dispose: () => void;
}

export const createTurnControl = ({
  signal,
  maxDurationMs,
}: {
  /** Host-owned; already aborted on entry skips the provider entirely. */
  signal?: AbortSignal;
  maxDurationMs: number;
}): TurnControl => {
  const controller = new AbortController();
  let aborted = false;
  let failure: TurnFailure | undefined;

  const fail = (error: AgentTurnError, cause?: unknown) => {
    failure ??= { error, cause };
    controller.abort();
  };
  const abort = () => {
    aborted = true;
    controller.abort();
  };

  if (signal?.aborted) abort();
  else signal?.addEventListener("abort", abort, { once: true });

  const deadline = setTimeout(
    () =>
      fail({
        kind: AgentErrorKind.BudgetExhausted,
        message: `The turn ran longer than ${Math.round(maxDurationMs / 1000)}s.`,
      }),
    maxDurationMs
  );

  return {
    controller,
    get aborted() {
      return aborted;
    },
    get failure() {
      return failure;
    },
    fail,
    endGeneration: () => clearTimeout(deadline),
    dispose: () => {
      clearTimeout(deadline);
      signal?.removeEventListener("abort", abort);
    },
  };
};
