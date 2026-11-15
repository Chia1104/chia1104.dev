import * as z from "zod";

import { env } from "./env";

const API_BASE_URL = "https://api.steampowered.com";
const REQUEST_TIMEOUT_MS = 8000;

/** How much the configured account has played one game. */
export interface SteamPlayStats {
  playtimeMinutes: number;
  /** `null` for a game that is owned and never started. */
  lastPlayedAt: Date | null;
  /** `null` for a game that has no achievements. */
  achievements: { unlocked: number; total: number } | null;
}

/** A private profile answers with an empty `response`, so `games` is optional. */
const ownedGamesSchema = z.object({
  response: z.object({
    games: z
      .array(
        z.object({
          appid: z.number().int(),
          /** Minutes. */
          playtime_forever: z.number().int(),
          /** Unix seconds; 0 when never played. */
          rtime_last_played: z.number().int().optional(),
        })
      )
      .optional(),
  }),
});

const achievementsSchema = z.object({
  playerstats: z.object({
    achievements: z.array(z.object({ achieved: z.number().int() })).optional(),
  }),
});

const request = (
  path: string,
  params: Record<string, string>,
  signal?: AbortSignal
) => {
  const timeout = AbortSignal.timeout(REQUEST_TIMEOUT_MS);
  const query = new URLSearchParams({
    key: env.STEAM_API_KEY,
    format: "json",
    ...params,
  });
  return fetch(`${API_BASE_URL}${path}?${query}`, {
    signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
  });
};

/** `null` when the game has no achievements; Steam answers 400 for those. */
const getAchievements = async (appId: number, signal?: AbortSignal) => {
  const response = await request(
    "/ISteamUserStats/GetPlayerAchievements/v1/",
    { steamid: env.STEAM_ID, appid: String(appId) },
    signal
  );
  if (response.status === 400) return null;
  if (!response.ok) {
    throw new Error(`Steam achievements responded ${response.status}`);
  }
  const { achievements } = achievementsSchema.parse(
    await response.json()
  ).playerstats;
  if (!achievements || achievements.length === 0) return null;
  return {
    unlocked: achievements.filter((item) => item.achieved === 1).length,
    total: achievements.length,
  };
};

/**
 * Playtime and achievements of one game for the configured account. `null` when the account does
 * not own the game, or keeps its game details private.
 */
export const getSteamPlayStats = async (
  appId: number,
  signal?: AbortSignal
): Promise<SteamPlayStats | null> => {
  const response = await request(
    "/IPlayerService/GetOwnedGames/v1/",
    {
      // Service interfaces take array arguments only through `input_json`.
      input_json: JSON.stringify({
        steamid: env.STEAM_ID,
        include_played_free_games: true,
        appids_filter: [appId],
      }),
    },
    signal
  );
  if (!response.ok) {
    throw new Error(`Steam owned games responded ${response.status}`);
  }
  const game = ownedGamesSchema
    .parse(await response.json())
    .response.games?.find((owned) => owned.appid === appId);
  if (!game) return null;

  return {
    playtimeMinutes: game.playtime_forever,
    lastPlayedAt: game.rtime_last_played
      ? new Date(game.rtime_last_played * 1000)
      : null,
    achievements: await getAchievements(appId, signal),
  };
};
