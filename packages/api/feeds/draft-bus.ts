import type { FeedDraftNotice } from "@chia/db/repos/drafts/notice";

type Listener = () => void;

/**
 * In-process fan-out of `feed_draft` notices to open watch streams, keyed by draft. The host
 * feeds it from a Postgres LISTEN; nothing here does IO.
 */
export class FeedDraftBus {
  private readonly listeners = new Map<number, Set<Listener>>();

  publish(notice: FeedDraftNotice): void {
    for (const listener of this.listeners.get(notice.draftId) ?? []) {
      listener();
    }
  }

  subscribe(draftId: number, listener: Listener): () => void {
    const set = this.listeners.get(draftId) ?? new Set<Listener>();
    set.add(listener);
    this.listeners.set(draftId, set);
    return () => {
      set.delete(listener);
      if (set.size === 0) this.listeners.delete(draftId);
    };
  }

  /** Resynchronize all active drafts after the database listener reconnects. */
  resync(): void {
    for (const listeners of this.listeners.values()) {
      for (const listener of listeners) listener();
    }
  }
}
