/**
 * Ports every agent kind needs, regardless of what it does.
 *
 * Domain ports (content access, staging buffers) belong to the kind that defines them — see
 * `@chia/agent-writing/ports`.
 */

export type PendingMessageKind = "steer" | "followUp";

export interface PendingMessage {
  id: string;
  kind: PendingMessageKind;
  text: string;
}

/**
 * Queue for messages that arrive while a turn is already running.
 *
 * `AgentHarness.steer()` is a method rather than a callback, so a message that arrives over HTTP
 * cannot reach into the running harness. The transport enqueues here and the turn drains it at
 * pi's queue drain points.
 */
export interface PendingMessageStore {
  push(
    sessionId: string,
    kind: PendingMessageKind,
    text: string
  ): Promise<void>;
  /** Atomically returns unconsumed messages and marks them consumed. */
  claim(sessionId: string): Promise<PendingMessage[]>;
}
