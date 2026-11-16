import {
  FEED_MODE_TYPES,
  FeedMode,
  FeedType,
  isFeedTypeOf,
} from "@chia/db/types";
import type { FeedTypeOf } from "@chia/db/types";

import type { RouterOutputs } from "@/libs/orpc/types";

/** The kinds of writing the hobby mode carries. */
export type HobbyFeedType = FeedTypeOf<typeof FeedMode.Hobby>;

export type HobbyFeed = RouterOutputs["feeds"]["list"]["items"][number];

/** The path segment under `/hobby` that lists each type; `feedPath` in `@chia/utils/config` ends in the same ones. */
export const HOBBY_FEED_SEGMENT = {
  [FeedType.Guide]: "guides",
  [FeedType.Review]: "reviews",
  [FeedType.Journal]: "journal",
} as const satisfies Record<HobbyFeedType, string>;

export const hobbyFeedTypeOfSegment = (
  segment: string
): HobbyFeedType | undefined =>
  FEED_MODE_TYPES[FeedMode.Hobby].find(
    (type) => HOBBY_FEED_SEGMENT[type] === segment
  );

/** An article's own page. */
export const hobbyFeedHrefOf = (feed: { type: HobbyFeedType; slug: string }) =>
  `/hobby/${HOBBY_FEED_SEGMENT[feed.type]}/${feed.slug}` as const;

/** Narrows a listed feed to a hobby article; a list asked for with `mode: hobby` holds nothing else. */
export const isHobbyFeedType = (type: string): type is HobbyFeedType =>
  isFeedTypeOf(FeedMode.Hobby, type);
