import { resolveDatabaseUrl } from "@chia/db/client";
import { listenChannel } from "@chia/db/listen";
import {
  FEED_DRAFT_CHANNEL,
  feedDraftNoticeSchema,
} from "@chia/db/repos/drafts/notice";
import { logger } from "@chia/observability/logger";
import { reportError } from "@chia/observability/report";
import { FeedDraftBus } from "@chia/services/feeds/draft-bus";

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
        logger.warn("Ignoring a feed_draft notice that is not JSON");
        return;
      }
      const parsed = feedDraftNoticeSchema.safeParse(json);
      if (!parsed.success) {
        logger.warn("Ignoring a feed_draft notice of unknown shape");
        return;
      }
      feedDraftBus.publish(parsed.data);
    },
    {
      signal,
      onError: (error) =>
        reportError(error, "feed_draft listener lost its connection"),
      onConnect: () => {
        feedDraftBus.resync();
        logger.info("feed_draft listener connected");
      },
    }
  );
};
