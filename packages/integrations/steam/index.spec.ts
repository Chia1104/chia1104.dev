import { afterEach, describe, expect, it, vi } from "vitest";

import { getSteamPlayStats } from ".";

vi.mock("./env", () => ({
  env: { STEAM_API_KEY: "key", STEAM_ID: "76561198000000000" },
}));

interface Answer {
  status?: number;
  /** The response body, already serialised. */
  json: string;
}

/** One answer per endpoint, picked by the interface method in the URL; the schema's by language. */
const respond = (answers: {
  owned: Answer;
  player?: Answer;
  schema?: Partial<Record<"english" | "tchinese", Answer>>;
  global?: Answer;
}) =>
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
    const url = new URL(String(input));
    const language = url.searchParams.get("l");
    const answer = url.pathname.includes("GetOwnedGames")
      ? answers.owned
      : url.pathname.includes("GetPlayerAchievements")
        ? answers.player
        : url.pathname.includes("GetSchemaForGame")
          ? answers.schema?.[language === "tchinese" ? "tchinese" : "english"]
          : answers.global;
    if (!answer) throw new Error(`Unexpected Steam request: ${url.pathname}`);
    return new Response(answer.json, { status: answer.status ?? 200 });
  });

const ownedGame = JSON.stringify({
  response: {
    games: [
      { appid: 1245620, playtime_forever: 5220, rtime_last_played: 1793491200 },
    ],
  },
});

const schemaOf = (
  achievements: {
    name: string;
    displayName: string;
    description?: string;
    hidden: number;
  }[]
) =>
  JSON.stringify({
    game: {
      availableGameStats: {
        // Two of the hosts the API has named over the years; the file name is a hex digest.
        achievements: achievements.map((item) => ({
          ...item,
          icon: `https://steamcdn-a.akamaihd.net/steamcommunity/public/images/apps/1245620/${item.name.slice(-2)}aa.jpg`,
          icongray: `http://media.steampowered.com/steamcommunity/public/images/apps/1245620/${item.name.slice(-2)}bb.jpg`,
        })),
      },
    },
  });

const ICONS =
  "https://shared.fastly.steamstatic.com/community_assets/images/apps/1245620";

describe("Steam", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("reads playtime, last played and every achievement of an owned game", async () => {
    const fetchMock = respond({
      owned: { json: ownedGame },
      player: {
        json: JSON.stringify({
          playerstats: {
            achievements: [
              { apiname: "ACH01", achieved: 1, unlocktime: 1793400000 },
              { apiname: "ACH02", achieved: 0, unlocktime: 0 },
              { apiname: "ACH03", achieved: 1, unlocktime: 0 },
            ],
          },
        }),
      },
      schema: {
        english: {
          json: schemaOf([
            {
              name: "ACH01",
              displayName: "Elden Lord",
              description: "Achieved the Elden Lord ending",
              hidden: 0,
            },
            { name: "ACH02", displayName: "Age of the Stars", hidden: 1 },
            { name: "ACH03", displayName: "Roundtable Hold", hidden: 0 },
          ]),
        },
        tchinese: {
          json: schemaOf([
            {
              name: "ACH01",
              displayName: "艾爾登之王",
              description: "達成「艾爾登之王」結局",
              hidden: 0,
            },
            { name: "ACH02", displayName: "群星時代", hidden: 1 },
          ]),
        },
      },
      global: {
        json: JSON.stringify({
          achievementpercentages: {
            achievements: [
              { name: "ACH01", percent: "24.9" },
              { name: "ACH02", percent: "3.1" },
            ],
          },
        }),
      },
    });

    await expect(getSteamPlayStats(1245620)).resolves.toEqual({
      playtimeMinutes: 5220,
      lastPlayedAt: new Date(1793491200 * 1000),
      achievements: [
        {
          apiName: "ACH01",
          text: {
            english: {
              name: "Elden Lord",
              description: "Achieved the Elden Lord ending",
            },
            tchinese: {
              name: "艾爾登之王",
              description: "達成「艾爾登之王」結局",
            },
          },
          iconUrl: `${ICONS}/01aa.jpg`,
          lockedIconUrl: `${ICONS}/01bb.jpg`,
          hidden: false,
          globalPercent: 24.9,
          unlocked: true,
          unlockedAt: new Date(1793400000 * 1000),
        },
        {
          apiName: "ACH02",
          text: {
            english: { name: "Age of the Stars", description: null },
            tchinese: { name: "群星時代", description: null },
          },
          iconUrl: `${ICONS}/02aa.jpg`,
          lockedIconUrl: `${ICONS}/02bb.jpg`,
          hidden: true,
          globalPercent: 3.1,
          unlocked: false,
          unlockedAt: null,
        },
        {
          apiName: "ACH03",
          // No translation and no global figure: English stands in, the share stays unknown.
          text: {
            english: { name: "Roundtable Hold", description: null },
            tchinese: { name: "Roundtable Hold", description: null },
          },
          iconUrl: `${ICONS}/03aa.jpg`,
          lockedIconUrl: `${ICONS}/03bb.jpg`,
          hidden: false,
          globalPercent: null,
          unlocked: true,
          unlockedAt: null,
        },
      ],
    });
    const owned = new URL(String(fetchMock.mock.calls[0]?.[0]));
    expect(owned.searchParams.get("key")).toBe("key");
    expect(JSON.parse(owned.searchParams.get("input_json") ?? "")).toEqual({
      steamid: "76561198000000000",
      include_played_free_games: true,
      appids_filter: [1245620],
    });
  });

  it("reports no achievements for a game that has none, without asking for their schema", async () => {
    const fetchMock = respond({
      owned: { json: ownedGame },
      player: {
        status: 400,
        json: JSON.stringify({ playerstats: { success: false } }),
      },
    });

    await expect(getSteamPlayStats(1245620)).resolves.toMatchObject({
      playtimeMinutes: 5220,
      achievements: [],
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("refuses an icon that is not a Steam image file", async () => {
    respond({
      owned: { json: ownedGame },
      player: {
        json: JSON.stringify({
          playerstats: { achievements: [{ apiname: "ACH01", achieved: 1 }] },
        }),
      },
      schema: {
        english: {
          json: JSON.stringify({
            game: {
              availableGameStats: {
                achievements: [
                  {
                    name: "ACH01",
                    displayName: "Elden Lord",
                    hidden: 0,
                    icon: "https://evil.example/track?id=1",
                    icongray: "https://evil.example/track?id=2",
                  },
                ],
              },
            },
          }),
        },
        tchinese: { json: JSON.stringify({ game: {} }) },
      },
      global: { status: 403, json: "{}" },
    });

    await expect(getSteamPlayStats(1245620)).rejects.toThrow(
      "Not a Steam icon URL"
    );
  });

  it("answers null when the account does not own the game or hides its library", async () => {
    respond({ owned: { json: JSON.stringify({ response: {} }) } });

    await expect(getSteamPlayStats(1245620)).resolves.toBeNull();
  });

  it("throws when Steam refuses the key", async () => {
    respond({ owned: { status: 403, json: "{}" } });

    await expect(getSteamPlayStats(1245620)).rejects.toThrow("403");
  });
});
