import type {
  ToolCallEvent,
  ToolCallResult,
} from "@earendil-works/pi-agent-core";
import * as z from "zod";

import type { JsonValue } from "@chia/utils/json";

import type { AgentTurnBudget } from "../types.ts";

const jsonValueSchema: z.ZodType<JsonValue> = z.json();
const jsonObjectSchema = z.record(z.string(), jsonValueSchema);

/**
 * Per-turn tool-call budget, composed into the same Pi `tool_call` hook as the approval gate.
 *
 * Pi's loop is `while (true)` over "the assistant message still carries tool calls"; it has no
 * step limit of its own, so a model that keeps re-issuing a call would run until the operator
 * aborts. This is the only place a runaway turn can be stopped from inside, and it works in two
 * registers: a *refusal* (a tool error the model reads, the same channel the approval gate uses
 * to talk to it) and, when the model keeps going through the refusals, an *exhaustion* the host
 * turns into an abort.
 *
 * The hook must run before the gate and their results must be composed by the caller: Pi's
 * `emitHook` keeps the last defined result, so two independent `tool_call` handlers would let
 * whichever registered later override the other.
 */

export interface PiTurnBudgetOptions {
  budget: AgentTurnBudget;
  /**
   * Called once, the first time the hard limit is crossed. The host is expected to abort the
   * harness; the budget itself can only refuse the call.
   */
  onExhausted: () => void;
}

export interface PiTurnBudget {
  handle: (event: ToolCallEvent) => ToolCallResult | undefined;
  /** Tool calls the model has emitted this turn, refused ones included. */
  readonly toolCalls: number;
}

/**
 * Canonical form of a call for repeat detection: key order must not matter, because the model
 * does not emit arguments in a stable order.
 */
const canonical = (value: JsonValue): string => {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  const record = jsonObjectSchema.safeParse(value).data;
  if (record === undefined) return JSON.stringify(value);
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonical(record[key] ?? null)}`)
    .join(",")}}`;
};

/** Tool arguments arrived from the provider as JSON; anything else has no stable identity. */
const callIdentity = (event: ToolCallEvent): string => {
  const input = jsonValueSchema.safeParse(event.input).data;
  return `${event.toolName} ${input === undefined ? event.toolCallId : canonical(input)}`;
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

export const createPiTurnBudget = (
  options: PiTurnBudgetOptions
): PiTurnBudget => {
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
          block: true,
          reason: "This turn has been stopped: its tool budget is exhausted.",
        };
      }

      if (toolCalls > budget.maxToolCalls) {
        return {
          block: true,
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
          block: true,
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
