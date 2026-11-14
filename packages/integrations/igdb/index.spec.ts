import { afterEach, describe, expect, it, vi } from "vitest";

import { getIgdbGame, searchIgdbGames } from ".";

vi.mock("./env", () => ({
  env: { IGDB_CLIENT_ID: "client-id", IGDB_CLIENT_SECRET: "client-secret" },
}));

const game = {
  id: 119133,
  name: "Elden Ring",
  first_release_date: 1645747200,
  cover: { image_id: "co4jni" },
  url: "https://www.igdb.com/games/elden-ring",
};

/** Answers the Twitch token request and every IGDB request after it. */
const respond = (games: object[]) =>
  vi
    .spyOn(globalThis, "fetch")
    .mockImplementation(async (input) =>
      String(input).includes("id.twitch.tv")
        ? new Response(
            JSON.stringify({ access_token: "app-token", expires_in: 3600 })
          )
        : new Response(JSON.stringify(games))
    );

describe("IGDB", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("searches with an app token and maps each game", async () => {
    const fetchMock = respond([game]);

    await expect(searchIgdbGames('elden "ring"')).resolves.toEqual([
      {
        id: 119133,
        name: "Elden Ring",
        releaseYear: 2022,
        coverUrl:
          "https://images.igdb.com/igdb/image/upload/t_cover_big_2x/co4jni.jpg",
        url: "https://www.igdb.com/games/elden-ring",
      },
    ]);
    const [, init] = fetchMock.mock.calls.at(-1) ?? [];
    expect(new Headers(init?.headers).get("Authorization")).toBe(
      "Bearer app-token"
    );
    expect(String(init?.body)).toContain('search "elden  ring ";');
  });

  it("reuses the token and answers null for an unknown game", async () => {
    const fetchMock = respond([]);

    await expect(getIgdbGame(1)).resolves.toBeNull();
    expect(
      fetchMock.mock.calls.filter(([input]) =>
        String(input).includes("id.twitch.tv")
      )
    ).toHaveLength(0);
  });
});
