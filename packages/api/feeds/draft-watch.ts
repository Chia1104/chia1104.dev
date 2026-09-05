import type { DB } from "@chia/db/client";
import {
  getFeedDraftStatus,
  listFeedDraftRevisionsSince,
} from "@chia/db/repos/drafts";
import type { FeedDraftNotice } from "@chia/db/repos/drafts/notice";
import { AppError } from "@chia/service-kit/errors";

import type { FeedDraftBus } from "./draft-bus";

export type FeedDraftWatchEvent = FeedDraftNotice | { type: "ping" };

export interface WatchFeedDraftInput {
  draftId: number;
  adminId: string;
  /** Revisions above this are replayed first. */
  afterRevision: number;
  /** Wakes the loop as soon as a write lands; without it the loop is the poll alone. */
  bus?: FeedDraftBus;
  signal?: AbortSignal;
  /** How long to wait for a notice before reading the trail anyway. */
  pollMs?: number;
  /** Idle time before a `ping` keeps the connection alive. */
  pingMs?: number;
}

const DEFAULT_POLL_MS = 5_000;
const DEFAULT_PING_MS = 30_000;

const sleep = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve) => {
    const timer = setTimeout(done, ms);
    function done() {
      clearTimeout(timer);
      signal?.removeEventListener("abort", done);
      resolve();
    }
    if (signal?.aborted) done();
    else signal?.addEventListener("abort", done, { once: true });
  });

/**
 * The revision trail is the source of truth and the bus only the wake-up call: every pass
 * reads what the trail holds above the cursor, so a notice that never arrived (a listener
 * reconnecting) costs latency, not events. A coalesced operator save moves its row's
 * revision forward, so it is read again as the newer revision.
 */
async function* tail(
  db: DB,
  input: WatchFeedDraftInput
): AsyncGenerator<FeedDraftWatchEvent, void, void> {
  const { draftId, signal } = input;
  const pollMs = input.pollMs ?? DEFAULT_POLL_MS;
  const pingMs = input.pingMs ?? DEFAULT_PING_MS;

  let cursor = input.afterRevision;
  // Apply does not advance the revision cursor; replay its current state on every connection.
  let applied: number | null = null;
  let quietSince = Date.now();

  while (!signal?.aborted) {
    const draft = await getFeedDraftStatus(db, draftId);
    if (!draft) {
      yield { type: "discarded", draftId };
      return;
    }

    let moved = false;
    for (const row of await listFeedDraftRevisionsSince(db, {
      draftId,
      afterRevision: cursor,
    })) {
      cursor = row.revision;
      moved = true;
      yield {
        type: "revision",
        draftId,
        revision: row.revision,
        author: row.author,
        sessionId: row.sessionId,
        changes: row.changes,
      };
    }
    if (
      draft.feedId !== null &&
      draft.appliedRevision !== null &&
      draft.appliedRevision !== applied
    ) {
      applied = draft.appliedRevision;
      moved = true;
      yield {
        type: "applied",
        draftId,
        revision: applied,
        feedId: draft.feedId,
      };
    }

    if (moved) {
      quietSince = Date.now();
    } else if (Date.now() - quietSince >= pingMs) {
      quietSince = Date.now();
      yield { type: "ping" };
    }

    if (input.bus) {
      await input.bus.next(draftId, { timeoutMs: pollMs, signal });
    } else {
      await sleep(pollMs, signal);
    }
  }
}

/** Checks ownership before streaming; a missing draft emits discarded, including on reconnect. */
export const watchFeedDraft = async (
  db: DB,
  input: WatchFeedDraftInput
): Promise<AsyncGenerator<FeedDraftWatchEvent, void, void>> => {
  const initial = await getFeedDraftStatus(db, input.draftId);
  if (initial && initial.userId !== input.adminId) {
    throw new AppError("NOT_FOUND", {
      message: `Draft ${input.draftId} not found`,
    });
  }
  return tail(db, input);
};
