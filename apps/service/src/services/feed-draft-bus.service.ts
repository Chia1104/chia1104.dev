import { FeedDraftBus } from "@chia/api/feeds/draft-bus";
import { resolveDatabaseUrl } from "@chia/db/client";
import { listenChannel } from "@chia/db/listen";
import {
  FEED_DRAFT_CHANNEL,
  feedDraftNoticeSchema,
} from "@chia/db/repos/drafts/notice";

/** One bus per process; every `draft:watch` stream on this replica subscribes here. */
export const feedDraftBus = new FeedDraftBus();

/** Feeds the bus from the `feed_draft` channel until `signal` fires. */
export const startFeedDraftListener = (signal: AbortSignal): void => {
  listenChannel(
    resolveDatabaseUrl(),
    FEED_DRAFT_CHANNEL,
    (payload) => {
      let json: unknown;
      try {
        json = JSON.parse(payload);
      } catch {
        console.warn("Ignoring a feed_draft notice that is not JSON", payload);
        return;
      }
      const parsed = feedDraftNoticeSchema.safeParse(json);
      if (!parsed.success) {
        console.warn("Ignoring a feed_draft notice of unknown shape", payload);
        return;
      }
      feedDraftBus.publish(parsed.data);
    },
    {
      signal,
      onError: (error) =>
        console.error("feed_draft listener lost its connection", error),
      onConnect: () => console.info("feed_draft listener connected"),
    }
  );
};
