"use client";

import { useEffect, useRef } from "react";

import type { feedsContracts } from "@chia/api/orpc/contracts";

import { client } from "@/libs/orpc/client";

/** Reconnect backoff for the watch stream, in ms: 1 s doubling to 10 s. */
const retryDelay = ({ attempt }: { attempt: number }) =>
  Math.min(10_000, 1_000 * 2 ** (attempt - 1));

/**
 * Tails the draft from the revision the caller loaded. The stream lives as long as the
 * draft id does; a dropped connection retries forever and resumes from the last event.
 */
export const useDraftWatch = (
  draftId: number,
  afterRevision: number,
  onEvent: (event: feedsContracts.FeedDraftWatchEvent) => void
) => {
  const handler = useRef(onEvent);
  handler.current = onEvent;
  // The cursor only matters for the first connection; later saves move it server-side.
  const start = useRef(afterRevision);

  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      try {
        const events = await client.feeds["draft:watch"](
          { draftId, afterRevision: start.current },
          {
            signal: controller.signal,
            context: { retry: Number.POSITIVE_INFINITY, retryDelay },
          }
        );
        for await (const event of events) {
          if (controller.signal.aborted) return;
          handler.current(event);
        }
      } catch (error) {
        if (!controller.signal.aborted) {
          console.error("Draft watch ended", error);
        }
      }
    })();
    return () => controller.abort();
  }, [draftId]);
};
