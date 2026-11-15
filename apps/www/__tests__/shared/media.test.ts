import { describe, expect, it } from "vitest";

import {
  AchievementRarity,
  achievementRarityOf,
  arrangeAchievements,
} from "@/shared/media";
import type { MediaAchievement } from "@/shared/media";

const achievement = (
  apiName: string,
  overrides: Partial<MediaAchievement> = {}
): MediaAchievement => ({
  apiName,
  translations: { en: { name: apiName } },
  iconUrl: "https://shared.fastly.steamstatic.com/a.jpg",
  lockedIconUrl: "https://shared.fastly.steamstatic.com/b.jpg",
  hidden: false,
  globalPercent: 50,
  unlocked: true,
  unlockedAt: null,
  ...overrides,
});

describe("achievementRarityOf", () => {
  it("frames an achievement as rare below a tenth of players and common from half", () => {
    expect(achievementRarityOf(9.9)).toBe(AchievementRarity.Rare);
    expect(achievementRarityOf(10)).toBe(AchievementRarity.Uncommon);
    expect(achievementRarityOf(49.9)).toBe(AchievementRarity.Uncommon);
    expect(achievementRarityOf(50)).toBe(AchievementRarity.Common);
  });

  it("treats an unknown share as common", () => {
    expect(achievementRarityOf(null)).toBe(AchievementRarity.Common);
  });
});

describe("arrangeAchievements", () => {
  it("lists the unlocked rarest first, then the locked nearest first, and only counts hidden locked ones", () => {
    const { listed, hiddenLocked } = arrangeAchievements([
      achievement("common", { globalPercent: 80 }),
      achievement("far", { unlocked: false, globalPercent: 2 }),
      achievement("secret", { unlocked: false, hidden: true }),
      achievement("rare", { globalPercent: 3 }),
      achievement("near", { unlocked: false, globalPercent: 60 }),
      achievement("found-secret", { hidden: true, globalPercent: 20 }),
      achievement("unmeasured", { globalPercent: null }),
    ]);

    expect(listed.map((item) => item.apiName)).toEqual([
      "rare",
      "found-secret",
      "common",
      "unmeasured",
      "near",
      "far",
    ]);
    expect(hiddenLocked).toBe(1);
  });
});
