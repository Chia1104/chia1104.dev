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
  /**
   * Puts claimed messages back in the queue.
   *
   * `claim` marks rows consumed *before* they are delivered, so a delivery that throws would
   * otherwise lose them silently. The caller releases whatever it could not hand over.
   */
  release(ids: string[]): Promise<void>;
}

/**
 * Best-effort wake-up channel for a {@link PendingMessageStore}.
 *
 * Carries no payload and guarantees no delivery — the message itself is already durable in the
 * store. This only shortens the wait between "the operator pressed send" and "the running turn
 * looks". A dropped notification costs exactly the store's polling interval, which is why the
 * poller stays.
 */
export interface PendingMessageNotifier {
  publish(sessionId: string): Promise<void>;
  /** Resolves to an unsubscribe function. */
  subscribe(
    sessionId: string,
    onNotify: () => void
  ): Promise<() => Promise<void>>;
}
