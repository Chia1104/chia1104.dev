import { asJsonValue, stableStringify } from "@chia/utils/json";

import type {
  AgentTurnBudget,
  ToolCallRefusal,
  ToolCallRequest,
} from "../types.ts";

/**
 * Per-turn tool-call budget: the only bound on a turn whose model keeps emitting tool calls. Two
 * registers: a refusal (a tool error the model reads) and, when the model keeps going through
 * the refusals, an exhaustion the host turns into an abort.
 *
 * The budget runs before the approval gate: a call the budget refuses must never reach the
 * operator.
 */

export interface TurnBudgetOptions {
  budget: AgentTurnBudget;
  /**
   * Called once, the first time the hard limit is crossed. The host is expected to abort the
   * turn; the budget itself can only refuse the call.
   */
  onExhausted: () => void;
}

export interface TurnBudget {
  handle: (event: ToolCallRequest) => ToolCallRefusal | undefined;
  /** Tool calls the model has emitted this turn, refused ones included. */
  readonly toolCalls: number;
}

/** Tool arguments arrived from the provider as JSON; anything else has no stable identity. */
const callIdentity = (event: ToolCallRequest): string => {
  const input = asJsonValue(event.input);
  return `${event.toolName} ${input === undefined ? event.toolCallId : stableStringify(input)}`;
};

/** Node clamps longer timer delays to 1ms, which would fire the deadline at once. */
const MAX_TIMER_DELAY_MS = 2_147_483_647;

const isCount = (value: number): boolean =>
  Number.isSafeInteger(value) && value >= 1;

export const assertTurnBudget = (budget: AgentTurnBudget): void => {
  if (!isCount(budget.maxToolCalls)) {
    throw new Error("maxToolCalls must be a positive integer.");
  }
  if (
    !isCount(budget.hardMaxToolCalls) ||
    budget.hardMaxToolCalls < budget.maxToolCalls
  ) {
    throw new Error(
      "hardMaxToolCalls must be a positive integer of at least maxToolCalls."
    );
  }
  if (!isCount(budget.maxRepeats)) {
    throw new Error("maxRepeats must be a positive integer.");
  }
  if (
    !Number.isFinite(budget.maxDurationMs) ||
    budget.maxDurationMs < 1 ||
    budget.maxDurationMs > MAX_TIMER_DELAY_MS
  ) {
    throw new Error(
      `maxDurationMs must be between 1 and ${MAX_TIMER_DELAY_MS}.`
    );
  }
};

export const createTurnBudget = (options: TurnBudgetOptions): TurnBudget => {
  const { budget } = options;
  assertTurnBudget(budget);

  let toolCalls = 0;
  let lastCall: string | undefined;
  let repeats = 0;
  let exhausted = false;

  return {
    get toolCalls() {
      return toolCalls;
    },
    handle(event) {
      toolCalls += 1;

      if (toolCalls > budget.hardMaxToolCalls) {
        if (!exhausted) {
          exhausted = true;
          options.onExhausted();
        }
        return {
          reason: "This turn has been stopped: its tool budget is exhausted.",
        };
      }

      if (toolCalls > budget.maxToolCalls) {
        return {
          reason:
            `This turn's tool budget (${budget.maxToolCalls} calls) is used up. ` +
            "Do not call any more tools. Answer now from what you already have, " +
            "and say what you could not finish.",
        };
      }

      const key = callIdentity(event);
      if (key === lastCall) {
        repeats += 1;
      } else {
        lastCall = key;
        repeats = 1;
      }
      if (repeats > budget.maxRepeats) {
        return {
          reason:
            `\`${event.toolName}\` was already called ${budget.maxRepeats} times in a row with ` +
            "these exact arguments and the result will not change. Do not call it again with " +
            "the same arguments: use the result you already have, change the arguments, or " +
            "answer without it.",
        };
      }

      return undefined;
    },
  };
};
