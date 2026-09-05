import type { FeedDraftNotice } from "@chia/db/repos/drafts/notice";

type Listener = (notice: FeedDraftNotice) => void;

/**
 * In-process fan-out of `feed_draft` notices to open watch streams, keyed by draft. The host
 * feeds it from a Postgres LISTEN; nothing here does IO.
 */
export class FeedDraftBus {
  private readonly listeners = new Map<number, Set<Listener>>();

  publish(notice: FeedDraftNotice): void {
    for (const listener of this.listeners.get(notice.draftId) ?? []) {
      listener(notice);
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

  /** The next notice for the draft, or `null` once `timeoutMs` passes or `signal` fires. */
  next(
    draftId: number,
    options: { timeoutMs: number; signal?: AbortSignal }
  ): Promise<FeedDraftNotice | null> {
    return new Promise((resolve) => {
      const settle = (notice: FeedDraftNotice | null) => {
        clearTimeout(timer);
        unsubscribe();
        options.signal?.removeEventListener("abort", onAbort);
        resolve(notice);
      };
      const onAbort = () => settle(null);
      const timer = setTimeout(() => settle(null), options.timeoutMs);
      const unsubscribe = this.subscribe(draftId, settle);
      if (options.signal?.aborted) {
        settle(null);
        return;
      }
      options.signal?.addEventListener("abort", onAbort, { once: true });
    });
  }
}
