import type {
  InsertMediaAchievementDTO,
  MediaPlayStats,
} from "@chia/db/repos/media";
import { Locale } from "@chia/db/types";
import {
  MEDIA_ACHIEVEMENT_DESCRIPTION_MAX_CHARS,
  MEDIA_ACHIEVEMENT_NAME_MAX_CHARS,
} from "@chia/db/validator/media";
import type {
  SteamAchievement,
  SteamAchievementText,
} from "@chia/integrations/steam";

/** Loaded on first use, so only a process that syncs a game parses the Steam env. */
const loadSteam = () => import("@chia/integrations/steam");

/** What one Steam read stores: the counters on the entry, and the game's achievements. */
export interface SteamPlaySync {
  stats: MediaPlayStats;
  achievements: InsertMediaAchievementDTO[];
}

/** Cut to what a row holds; a game that leaves a name empty is listed by its API name. */
const translationOf = (text: SteamAchievementText, apiName: string) => ({
  name: (text.name.trim() || apiName).slice(
    0,
    MEDIA_ACHIEVEMENT_NAME_MAX_CHARS
  ),
  description:
    text.description
      ?.trim()
      .slice(0, MEDIA_ACHIEVEMENT_DESCRIPTION_MAX_CHARS) || undefined,
});

/**
 * A game's play stats and achievements as rows store them, read from Steam. `null` when the
 * configured account does not own the app or keeps its game details private.
 */
export const readSteamPlaySync = async (
  steamAppId: number,
  signal?: AbortSignal
): Promise<SteamPlaySync | null> => {
  const { SteamLanguage, getSteamPlayStats } = await loadSteam();
  const play = await getSteamPlayStats(steamAppId, signal);
  if (!play) return null;

  const rowOf = (item: SteamAchievement): InsertMediaAchievementDTO => ({
    apiName: item.apiName,
    translations: {
      [Locale.En]: translationOf(
        item.text[SteamLanguage.English],
        item.apiName
      ),
      [Locale.ZhTW]: translationOf(
        item.text[SteamLanguage.TraditionalChinese],
        item.apiName
      ),
    },
    iconUrl: item.iconUrl,
    lockedIconUrl: item.lockedIconUrl,
    hidden: item.hidden,
    globalPercent: item.globalPercent,
    unlocked: item.unlocked,
    unlockedAt: item.unlockedAt,
  });
  const total = play.achievements.length;

  return {
    stats: {
      playtimeMinutes: play.playtimeMinutes,
      achievementsUnlocked:
        total === 0
          ? null
          : play.achievements.filter((item) => item.unlocked).length,
      achievementsTotal: total === 0 ? null : total,
      lastPlayedAt: play.lastPlayedAt,
    },
    achievements: play.achievements.map(rowOf),
  };
};
