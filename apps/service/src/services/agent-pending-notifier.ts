import type { PendingMessageNotifier } from "@chia/agent-runtime";
import { getRedisPubSub } from "@chia/kv/pubsub";

/**
 * Wake-up channel for `agent_pending_message`.
 *
 * The HTTP handler that queues a steer and the workflow step that drains it are different
 * processes, so the row in Postgres is the only thing they truly share. This shaves the drain
 * latency off that hand-off by telling the running turn to look now instead of at its next poll.
 *
 * The channel carries **no payload**: the message is already durable in the table, so a lost
 * notification costs one poll interval and nothing more. Widening it to carry the text would turn
 * a delivery failure back into data loss.
 *
 * `null` whenever the cache is not Redis — the poller alone is exactly today's behaviour.
 */
const channelFor = (sessionId: string) => `agent:pending:${sessionId}`;

export const getAgentPendingNotifier = (): PendingMessageNotifier | null => {
  const pubsub = getRedisPubSub();
  if (!pubsub) return null;

  return {
    async publish(sessionId) {
      await pubsub.publish(channelFor(sessionId));
    },
    async subscribe(sessionId, onNotify) {
      return await pubsub.subscribe(channelFor(sessionId), () => onNotify());
    },
  };
};
