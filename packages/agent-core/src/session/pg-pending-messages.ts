import { uuidv7 } from "@earendil-works/pi-agent-core";

import type { DB } from "@chia/db";
import {
  claimAgentPendingMessages,
  peekAgentPendingMessages,
  pushAgentPendingMessage,
} from "@chia/db/repos/agent";

import type {
  PendingMessage,
  PendingMessageKind,
  PendingMessageStore,
} from "../ports.ts";

/** {@link PendingMessageStore} over `agent_pending_message`. */
export class PgPendingMessageStore implements PendingMessageStore {
  constructor(private readonly db: DB) {}

  async push(
    sessionId: string,
    kind: PendingMessageKind,
    text: string
  ): Promise<void> {
    await pushAgentPendingMessage(this.db, {
      id: uuidv7(),
      sessionId,
      kind,
      text,
    });
  }

  async claim(sessionId: string): Promise<PendingMessage[]> {
    const rows = await claimAgentPendingMessages(this.db, sessionId);
    return rows.map((row) => ({
      id: row.id,
      kind: row.kind as PendingMessageKind,
      text: row.text,
    }));
  }

  /** Unconsumed messages, for showing a queue indicator without draining it. */
  async peek(sessionId: string): Promise<PendingMessage[]> {
    const rows = await peekAgentPendingMessages(this.db, sessionId);
    return rows.map((row) => ({
      id: row.id,
      kind: row.kind as PendingMessageKind,
      text: row.text,
    }));
  }
}

/** In-memory counterpart for tests. */
export class InMemoryPendingMessageStore implements PendingMessageStore {
  private readonly queues = new Map<string, PendingMessage[]>();

  push(
    sessionId: string,
    kind: PendingMessageKind,
    text: string
  ): Promise<void> {
    const queue = this.queues.get(sessionId) ?? [];
    queue.push({ id: uuidv7(), kind, text });
    this.queues.set(sessionId, queue);
    return Promise.resolve();
  }

  claim(sessionId: string): Promise<PendingMessage[]> {
    const queue = this.queues.get(sessionId) ?? [];
    this.queues.set(sessionId, []);
    return Promise.resolve(queue);
  }
}
