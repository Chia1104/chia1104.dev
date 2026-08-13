import { uuidv7 } from "@earendil-works/pi-agent-core";

import type { DB } from "@chia/db";
import {
  claimAgentPendingMessages,
  peekAgentPendingMessages,
  pushAgentPendingMessage,
  releaseAgentPendingMessages,
} from "@chia/db/repos/agent";

import type {
  PendingMessage,
  PendingMessageKind,
  PendingMessageStore,
} from "../ports.ts";

/** Pi turn queue backed by `agent_pending_message`. */
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

  async release(ids: string[]): Promise<void> {
    await releaseAgentPendingMessages(this.db, ids);
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

/**
 * In-memory counterpart for tests.
 *
 * Mirrors the Postgres semantics rather than simplifying them: claimed messages are *marked*
 * consumed and kept, not dropped, so `release` can put them back the way the table does.
 */
export class InMemoryPendingMessageStore implements PendingMessageStore {
  private readonly queues = new Map<
    string,
    { message: PendingMessage; consumed: boolean }[]
  >();

  push(
    sessionId: string,
    kind: PendingMessageKind,
    text: string
  ): Promise<void> {
    const queue = this.queues.get(sessionId) ?? [];
    queue.push({ message: { id: uuidv7(), kind, text }, consumed: false });
    this.queues.set(sessionId, queue);
    return Promise.resolve();
  }

  claim(sessionId: string): Promise<PendingMessage[]> {
    const queue = this.queues.get(sessionId) ?? [];
    const claimed: PendingMessage[] = [];
    for (const row of queue) {
      if (row.consumed) continue;
      row.consumed = true;
      claimed.push(row.message);
    }
    return Promise.resolve(claimed);
  }

  release(ids: string[]): Promise<void> {
    const wanted = new Set(ids);
    for (const queue of this.queues.values()) {
      for (const row of queue) {
        if (wanted.has(row.message.id)) row.consumed = false;
      }
    }
    return Promise.resolve();
  }

  /** Unconsumed messages, for assertions. Insertion order, like the table's `createdAt` order. */
  peek(sessionId: string): Promise<PendingMessage[]> {
    const queue = this.queues.get(sessionId) ?? [];
    return Promise.resolve(
      queue.filter((row) => !row.consumed).map((row) => row.message)
    );
  }
}
