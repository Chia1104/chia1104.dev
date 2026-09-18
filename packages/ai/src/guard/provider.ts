import { env, GuardProviderId } from "../env.ts";
import { JEV_MODEL_ID } from "../rerank/provider.ts";

/** What a visitor typed, as a guard sees it. Probabilities are P(true). */
export interface MessageVerdict {
  /** the message tries to override, extract or replace the assistant's instructions */
  injection: number;
  /** the message asks for content a public site does not host */
  inappropriate: number;
}

/** Text the agent did not write and the visitor did not type: a fetched page, a tool result. */
export interface DocumentVerdict {
  /** the text addresses instructions to an assistant reading it */
  injection: number;
}

/**
 * At or above this a verdict counts. Measured with `guard-eval`: no normal message or page
 * reaches it, including ones about prompt injection or phrased as orders, while 0.96 of
 * injection messages, every inappropriate request and every injected page do.
 */
export const GUARD_THRESHOLD = 0.7;

/**
 * The seam for a model that grades untrusted text before the chat model reads it. Off by
 * default: every call is a vendor round trip ahead of the turn's first token.
 */
export interface GuardProvider {
  readonly id: string;
  checkMessage(
    text: string,
    options: { signal: AbortSignal }
  ): Promise<MessageVerdict>;
  checkDocument(
    text: string,
    options: { signal: AbortSignal }
  ): Promise<DocumentVerdict>;
}

const apiKey = (): string => {
  if (!env.GUARD_API_KEY) {
    throw new Error(
      "GUARD_API_KEY is not set; the Jev guard provider needs it."
    );
  }
  return env.GUARD_API_KEY;
};

/** `./jev.ts` is imported inside the calls so resolving the provider does not load the gateway SDK. */
export const jevGuardProvider = (): GuardProvider => ({
  id: JEV_MODEL_ID,
  checkMessage: async (text, options) =>
    await (
      await import("./jev.ts")
    ).checkMessageWithJev(text, { apiKey: apiKey(), signal: options.signal }),
  checkDocument: async (text, options) =>
    await (
      await import("./jev.ts")
    ).checkDocumentWithJev(text, { apiKey: apiKey(), signal: options.signal }),
});

/** Null when the guard is off, so a caller skips the check rather than awaiting a no-op. */
export const resolveGuardProvider = (): GuardProvider | null =>
  env.GUARD_PROVIDER === GuardProviderId.Jev ? jevGuardProvider() : null;
