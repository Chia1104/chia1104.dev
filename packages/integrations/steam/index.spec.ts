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

/** Answers the owned-games request with `owned` and the achievements request with `achievements`. */
const respond = (owned: Answer, achievements: Answer) =>
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
    const answer = String(input).includes("GetOwnedGames")
      ? owned
      : achievements;
    return new Response(answer.json, { status: answer.status ?? 200 });
  });

const ownedGame = JSON.stringify({
  response: {
    games: [
      { appid: 1245620, playtime_forever: 5220, rtime_last_played: 1793491200 },
    ],
  },
});

describe("Steam", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("reads playtime, last played and the achievement count of an owned game", async () => {
    const fetchMock = respond(
      { json: ownedGame },
      {
        json: JSON.stringify({
          playerstats: {
            achievements: [{ achieved: 1 }, { achieved: 0 }, { achieved: 1 }],
          },
        }),
      }
    );

    await expect(getSteamPlayStats(1245620)).resolves.toEqual({
      playtimeMinutes: 5220,
      lastPlayedAt: new Date(1793491200 * 1000),
      achievements: { unlocked: 2, total: 3 },
    });
    const owned = new URL(String(fetchMock.mock.calls[0]?.[0]));
    expect(owned.searchParams.get("key")).toBe("key");
    expect(JSON.parse(owned.searchParams.get("input_json") ?? "")).toEqual({
      steamid: "76561198000000000",
      include_played_free_games: true,
      appids_filter: [1245620],
    });
  });

  it("reports no achievements for a game that has none", async () => {
    respond(
      { json: ownedGame },
      { status: 400, json: JSON.stringify({ playerstats: { success: false } }) }
    );

    await expect(getSteamPlayStats(1245620)).resolves.toMatchObject({
      playtimeMinutes: 5220,
      achievements: null,
    });
  });

  it("answers null when the account does not own the game or hides its library", async () => {
    respond({ json: JSON.stringify({ response: {} }) }, { json: "{}" });

    await expect(getSteamPlayStats(1245620)).resolves.toBeNull();
  });

  it("throws when Steam refuses the key", async () => {
    respond({ status: 403, json: "{}" }, { json: "{}" });

    await expect(getSteamPlayStats(1245620)).rejects.toThrow("403");
  });
});
