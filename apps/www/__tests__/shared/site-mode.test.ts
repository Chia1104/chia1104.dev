import { describe, it, expect } from "vitest";

import {
  otherSiteModeOf,
  SITE_MODE_HOME,
  SiteMode,
  siteModeOf,
} from "@/shared/site-mode";

describe("siteModeOf", () => {
  it.each([
    ["/", SiteMode.Tech],
    ["/posts/hello", SiteMode.Tech],
    ["/hobby", SiteMode.Hobby],
    ["/hobby/anime/some-work", SiteMode.Hobby],
    // A tech path that only starts with the same letters.
    ["/hobbyist", SiteMode.Tech],
  ])("%s belongs to %s", (pathname, mode) => {
    expect(siteModeOf(pathname)).toBe(mode);
  });

  it.each(Object.values(SiteMode))("the home of %s is in it", (mode) => {
    expect(siteModeOf(SITE_MODE_HOME[mode])).toBe(mode);
  });
});

describe("otherSiteModeOf", () => {
  it.each(Object.values(SiteMode))("leaves %s and comes back", (mode) => {
    expect(otherSiteModeOf(mode)).not.toBe(mode);
    expect(otherSiteModeOf(otherSiteModeOf(mode))).toBe(mode);
  });
});
