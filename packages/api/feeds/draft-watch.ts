import type { DB } from "@chia/db/client";
import { getFeedDraftStatus } from "@chia/db/repos/drafts";
import { AppError } from "@chia/service-kit/errors";

import type { FeedDraftWatchEvent } from "../orpc/contracts/feeds.contract";

import type { FeedDraftBus } from "./draft-bus";

interface WatchFeedDraftInput {
  draftId: number;
  adminId: string;
  bus?: FeedDraftBus;
  signal?: AbortSignal;
}

/** Keeps a subscription while yielding; bursts coalesce into one pending resync. */
async function* subscribe(
  bus: FeedDraftBus,
  { draftId, signal }: WatchFeedDraftInput
): AsyncGenerator<FeedDraftWatchEvent, void, void> {
  let dirty = true;
  let wake: (() => void) | undefined;
  const unsubscribe = bus.subscribe(draftId, () => {
    dirty = true;
    wake?.();
  });
  const onAbort = () => wake?.();
  signal?.addEventListener("abort", onAbort, { once: true });
  try {
    while (!signal?.aborted) {
      if (dirty) {
        dirty = false;
        yield { type: "resync" };
        continue;
      }
      let timer: ReturnType<typeof setTimeout> | undefined;
      try {
        await new Promise<void>((resolve) => {
          wake = resolve;
          timer = setTimeout(resolve, 30_000);
        });
      } finally {
        clearTimeout(timer);
        wake = undefined;
      }
      if (!signal?.aborted && !dirty) yield { type: "ping" };
    }
  } finally {
    unsubscribe();
    signal?.removeEventListener("abort", onAbort);
  }
}

/** Authorizes before streaming; the initial resync also detects a deleted draft. */
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
  if (!input.bus) throw new AppError("SERVICE_UNAVAILABLE");
  return subscribe(input.bus, input);
};
