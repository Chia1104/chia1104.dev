import { createHash } from "node:crypto";

import type {
  PromptScreenPort,
  PromptScreenSignal,
} from "@chia/api/orpc/services/prompt-screen";
import { PromptRejectedError } from "@chia/api/orpc/services/prompt-screen";
import type { DB } from "@chia/db/client";
import { recordAgentPromptScreen } from "@chia/db/repos/agent";
import type { JsonObject } from "@chia/utils/json";

/**
 * Screens one prompt and records the verdict, called by the generic service's `prompt()` after
 * its free local refusals (unknown session, `/end`, outstanding approval) and before anything is
 * enqueued — a blocked prompt starts no run and spends no quota.
 *
 * The record is written for `allow` too, and before the block is thrown: `agent.prompt_screen`
 * is the operator's only view of what the screen is doing, so a verdict that was acted on but
 * not recorded (or recorded but not acted on) must be impossible. A failed write therefore fails
 * the request rather than degrading to either half.
 */

/** Upper bound on one screen round-trip; the port budgets its classifiers within it. */
const SCREEN_TIMEOUT_MS = 8_000;

export interface ScreenPromptOptions {
  screen: PromptScreenPort | undefined;
  db: DB;
  userId: string;
  sessionId: string;
  kind: string;
  text: string;
}

export const screenPrompt = async (
  options: ScreenPromptOptions
): Promise<void> => {
  if (!options.screen) return;

  const verdict = await options.screen.screen(
    { text: options.text },
    AbortSignal.timeout(SCREEN_TIMEOUT_MS)
  );

  await recordAgentPromptScreen(options.db, {
    userId: options.userId,
    sessionId: options.sessionId,
    kind: options.kind,
    verdict: verdict.verdict,
    reason: verdict.verdict === "block" ? verdict.reason : undefined,
    signals: verdict.signals.map(toJsonSignal),
    textHash: createHash("sha256").update(options.text).digest("hex"),
    textLength: options.text.length,
  });

  if (verdict.verdict === "block") {
    throw new PromptRejectedError(verdict.reason);
  }
};

const toJsonSignal = (signal: PromptScreenSignal): JsonObject => {
  const json: JsonObject = {
    source: signal.source,
    label: signal.label,
    score: signal.score,
  };
  if (signal.error !== undefined) json.error = signal.error;
  return json;
};
