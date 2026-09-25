import type { MessageRefusal } from "@chia/agent-runtime/turn";
import type { AgentTurnMessage } from "@chia/agent-runtime/types";
import { GUARD_THRESHOLD } from "@chia/ai/guard/provider";
import type { GuardProvider } from "@chia/ai/guard/provider";
import { logger } from "@chia/observability/logger";

/** Measured calls end within 1.6 s; past this the guard is the outage, not the visitor. */
const SCREEN_TIMEOUT_MS = 3_000;
/** A refused message is not persisted, so the log keeps enough of it to become an eval case. */
const LOGGED_TEXT_CHARS = 500;

/** A selection's text comes from the client, so it is the visitor's input like the message. */
const typedText = (message: AgentTurnMessage): string =>
  [
    ...(message.attachments ?? []).flatMap((attachment) =>
      attachment.type === "selection" ? [attachment.text] : []
    ),
    message.text,
  ].join("\n\n");

/**
 * Turns away a message the guard grades as an injection attempt or an inappropriate request.
 * Fails open: a guard that errors or times out lets the message through, since the kind holds
 * nothing but published content and the quota still bounds what a visitor can spend.
 */
export const createMessageScreen =
  (guard: GuardProvider) =>
  async (
    message: AgentTurnMessage,
    signal?: AbortSignal
  ): Promise<MessageRefusal | undefined> => {
    const text = typedText(message);
    const timeout = AbortSignal.timeout(SCREEN_TIMEOUT_MS);
    try {
      const verdict = await guard.checkMessage(text, {
        signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
      });
      const flagged = (["injection", "inappropriate"] as const).filter(
        (key) => verdict[key] >= GUARD_THRESHOLD
      );
      if (flagged.length === 0) return undefined;
      logger.warn(
        { guard: guard.id, verdict, text: text.slice(0, LOGGED_TEXT_CHARS) },
        "Guard refused a message"
      );
      return {
        reason: `The guard flagged the message as ${flagged.join(", ")}.`,
      };
    } catch (error) {
      if (signal?.aborted) throw error;
      logger.warn(
        { err: error, guard: guard.id },
        "Guard failed; message let through"
      );
      return undefined;
    }
  };
