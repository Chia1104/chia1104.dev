import { describe, expect, it } from "vitest";

import { FEED_MODE_TYPES, FeedMode, FeedType } from "@chia/db/types";
import { feedPath } from "@chia/utils/config";

import {
  HOBBY_FEED_SEGMENT,
  hobbyFeedHrefOf,
  hobbyFeedTypeOfSegment,
} from "@/shared/hobby-feed";
import { MEDIA_KIND_SEGMENT } from "@/shared/media";

describe("hobby article paths", () => {
  it.each(FEED_MODE_TYPES[FeedMode.Hobby])(
    "serves a %s where the rest of the system links it",
    (type) => {
      expect(hobbyFeedHrefOf({ type, slug: "hello" })).toBe(
        feedPath({ type, slug: "hello" })
      );
      expect(hobbyFeedTypeOfSegment(HOBBY_FEED_SEGMENT[type])).toBe(type);
    }
  );

  it("shares no segment with the kinds of work, which the same route also lists", () => {
    const works: string[] = Object.values(MEDIA_KIND_SEGMENT);

    for (const segment of Object.values(HOBBY_FEED_SEGMENT)) {
      expect(works).not.toContain(segment);
    }
    expect(hobbyFeedTypeOfSegment("games")).toBeUndefined();
    expect(hobbyFeedTypeOfSegment(`${FeedType.Post}s`)).toBeUndefined();
  });
});
