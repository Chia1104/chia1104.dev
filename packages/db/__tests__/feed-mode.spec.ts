import { describe, expect, it } from "vitest";

import { feedType } from "../src/schemas/enums";
import {
  FEED_MODE_TYPES,
  FeedMode,
  feedModeOf,
  FeedType,
  isFeedTypeOf,
} from "../src/types";

describe("feed modes", () => {
  it("places every stored feed type in exactly one mode", () => {
    const placed = Object.values(FEED_MODE_TYPES).flat();

    expect(placed.toSorted()).toEqual([...feedType.enumValues].toSorted());
    for (const type of feedType.enumValues) {
      expect(FEED_MODE_TYPES[feedModeOf(type)]).toContain(type);
    }
  });

  it("keeps posts and notes on the tech site and the rest in the hobby mode", () => {
    expect(feedModeOf(FeedType.Note)).toBe(FeedMode.Tech);
    expect(feedModeOf(FeedType.Journal)).toBe(FeedMode.Hobby);
    expect(isFeedTypeOf(FeedMode.Tech, FeedType.Guide)).toBe(false);
    expect(isFeedTypeOf(FeedMode.Hobby, FeedType.Guide)).toBe(true);
    expect(isFeedTypeOf(FeedMode.Hobby, FeedType.All)).toBe(false);
  });
});
