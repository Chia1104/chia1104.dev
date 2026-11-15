import * as z from "zod";

import { env } from "./env";

const API_BASE_URL = "https://api.steampowered.com";
const REQUEST_TIMEOUT_MS = 8000;

/** Where Steam's own pages load achievement icons from; every icon is `<app id>/<file>` under it. */
const ICON_BASE_URL =
  "https://shared.fastly.steamstatic.com/community_assets/images/apps";

/** The languages an achievement's text is read in, as Steam names them. */
export const SteamLanguage = {
  English: "english",
  TraditionalChinese: "tchinese",
} as const;

export type SteamLanguage = (typeof SteamLanguage)[keyof typeof SteamLanguage];

export interface SteamAchievementText {
  name: string;
  /** `null` for a hidden achievement, whose description Steam keeps back. */
  description: string | null;
}

/** One achievement of a game, and where the configured account stands on it. */
export interface SteamAchievement {
  /** Steam's own name for it; unique within a game. */
  apiName: string;
  /** Steam answers in English where the game has no translation. */
  text: Record<SteamLanguage, SteamAchievementText>;
  iconUrl: string;
  /** The greyed icon Steam shows before the unlock. */
  lockedIconUrl: string;
  hidden: boolean;
  /** Share of the game's players who hold it, 0 to 100; `null` when Steam reports none. */
  globalPercent: number | null;
  unlocked: boolean;
  /** `null` while locked, and for an unlock older than Steam's record of the time. */
  unlockedAt: Date | null;
}

/** How much the configured account has played one game. */
export interface SteamPlayStats {
  playtimeMinutes: number;
  /** `null` for a game that is owned and never started. */
  lastPlayedAt: Date | null;
  /** In the order the game defines them; empty for a game that has none. */
  achievements: SteamAchievement[];
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

const playerAchievementsSchema = z.object({
  playerstats: z.object({
    achievements: z
      .array(
        z.object({
          apiname: z.string(),
          achieved: z.number().int(),
          /** Unix seconds; 0 while locked, and for unlocks Steam did not time. */
          unlocktime: z.number().int().optional(),
        })
      )
      .optional(),
  }),
});

/** The API has named several hosts for the same file over the years, so only the file is kept. */
const iconFileSchema = z.string().transform((url, context) => {
  const file = /\/([0-9a-f]+\.(?:jpg|png))(?:\?.*)?$/i.exec(url)?.[1];
  if (!file) {
    context.addIssue({ code: "custom", message: "Not a Steam icon URL" });
    return z.NEVER;
  }
  return file;
});

/** A game without achievements answers with an empty `game`. */
const gameSchemaSchema = z.object({
  game: z.object({
    availableGameStats: z
      .object({
        achievements: z
          .array(
            z.object({
              name: z.string(),
              displayName: z.string(),
              description: z.string().optional(),
              hidden: z.number().int(),
              icon: iconFileSchema,
              icongray: iconFileSchema,
            })
          )
          .optional(),
      })
      .optional(),
  }),
});

const globalPercentagesSchema = z.object({
  achievementpercentages: z.object({
    achievements: z.array(
      /** Steam sends the percentage as a string. */
      z.object({ name: z.string(), percent: z.coerce.number().min(0).max(100) })
    ),
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

const getGameSchema = async (
  appId: number,
  language: SteamLanguage,
  signal?: AbortSignal
) => {
  const response = await request(
    "/ISteamUserStats/GetSchemaForGame/v2/",
    { appid: String(appId), l: language },
    signal
  );
  if (!response.ok) {
    throw new Error(`Steam game schema responded ${response.status}`);
  }
  return (
    gameSchemaSchema.parse(await response.json()).game.availableGameStats
      ?.achievements ?? []
  );
};

/** Keyed by an achievement's API name. Steam lists none for a game too new or too small. */
const getGlobalPercentages = async (appId: number, signal?: AbortSignal) => {
  const response = await request(
    "/ISteamUserStats/GetGlobalAchievementPercentagesForApp/v2/",
    { gameid: String(appId) },
    signal
  );
  if (!response.ok) return new Map<string, number>();
  const { achievements } = globalPercentagesSchema.parse(
    await response.json()
  ).achievementpercentages;
  return new Map(achievements.map((item) => [item.name, item.percent]));
};

/** Empty when the game has no achievements; Steam answers 400 for those. */
const getAchievements = async (
  appId: number,
  signal?: AbortSignal
): Promise<SteamAchievement[]> => {
  const response = await request(
    "/ISteamUserStats/GetPlayerAchievements/v1/",
    { steamid: env.STEAM_ID, appid: String(appId) },
    signal
  );
  if (response.status === 400) return [];
  if (!response.ok) {
    throw new Error(`Steam achievements responded ${response.status}`);
  }
  const owned = playerAchievementsSchema.parse(await response.json())
    .playerstats.achievements;
  if (!owned || owned.length === 0) return [];

  const [english, chinese, percentages] = await Promise.all([
    getGameSchema(appId, SteamLanguage.English, signal),
    getGameSchema(appId, SteamLanguage.TraditionalChinese, signal),
    getGlobalPercentages(appId, signal),
  ]);
  const progress = new Map(owned.map((item) => [item.apiname, item]));
  const translated = new Map(chinese.map((item) => [item.name, item]));
  const textOf = (item: (typeof english)[number]): SteamAchievementText => ({
    name: item.displayName,
    description: item.description || null,
  });
  const iconUrlOf = (file: string) => `${ICON_BASE_URL}/${appId}/${file}`;

  return english.map((item) => {
    const mine = progress.get(item.name);
    const unlocked = mine?.achieved === 1;
    return {
      apiName: item.name,
      text: {
        [SteamLanguage.English]: textOf(item),
        [SteamLanguage.TraditionalChinese]: textOf(
          translated.get(item.name) ?? item
        ),
      },
      iconUrl: iconUrlOf(item.icon),
      lockedIconUrl: iconUrlOf(item.icongray),
      hidden: item.hidden === 1,
      globalPercent: percentages.get(item.name) ?? null,
      unlocked,
      unlockedAt:
        unlocked && mine.unlocktime ? new Date(mine.unlocktime * 1000) : null,
    };
  });
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
