import type { MediaPlayStats } from "@chia/db/repos/media";

/** Loaded on first use, so only a process that syncs a game parses the Steam env. */
const loadSteam = () => import("@chia/integrations/steam");

/**
 * A game's play stats as a row stores them, read from Steam. `null` when the configured account
 * does not own the app or keeps its game details private.
 */
export const readSteamPlayStats = async (
  steamAppId: number,
  signal?: AbortSignal
): Promise<MediaPlayStats | null> => {
  const { getSteamPlayStats } = await loadSteam();
  const stats = await getSteamPlayStats(steamAppId, signal);
  if (!stats) return null;
  return {
    playtimeMinutes: stats.playtimeMinutes,
    achievementsUnlocked: stats.achievements?.unlocked ?? null,
    achievementsTotal: stats.achievements?.total ?? null,
    lastPlayedAt: stats.lastPlayedAt,
  };
};
