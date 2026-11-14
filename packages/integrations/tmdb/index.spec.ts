import { afterEach, describe, expect, it, vi } from "vitest";

import { TmdbLanguage, TmdbMediaType, getTmdbWork, searchTmdb } from ".";

vi.mock("./env", () => ({ env: { TMDB_ACCESS_TOKEN: "token" } }));

/** `json` is the response body, already serialised. */
const respond = (json: string, status = 200) =>
  vi
    .spyOn(globalThis, "fetch")
    .mockResolvedValue(new Response(json, { status }));

describe("TMDB", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("searches films with the bearer token and maps film fields", async () => {
    const fetchMock = respond(
      JSON.stringify({
        results: [
          {
            id: 603,
            title: "駭客任務",
            original_title: "The Matrix",
            release_date: "1999-03-31",
            poster_path: "/matrix.jpg",
            backdrop_path: "/matrix-wide.jpg",
          },
        ],
      })
    );

    await expect(
      searchTmdb(TmdbMediaType.Movie, "matrix", TmdbLanguage.ZhTW)
    ).resolves.toEqual([
      {
        id: 603,
        title: "駭客任務",
        originalTitle: "The Matrix",
        releaseYear: 1999,
        posterUrl: "https://image.tmdb.org/t/p/w780/matrix.jpg",
        backdropUrl: "https://image.tmdb.org/t/p/w1280/matrix-wide.jpg",
        url: "https://www.themoviedb.org/movie/603",
      },
    ]);
    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(String(url)).toContain("/search/movie?query=matrix&language=zh-TW");
    expect(new Headers(init?.headers).get("Authorization")).toBe(
      "Bearer token"
    );
  });

  it("maps a series by its name and first air date, without a poster", async () => {
    respond(
      JSON.stringify({
        id: 1396,
        name: "絕命毒師",
        original_name: "Breaking Bad",
        first_air_date: "",
        poster_path: null,
      })
    );

    await expect(
      getTmdbWork(TmdbMediaType.Tv, 1396, TmdbLanguage.ZhTW)
    ).resolves.toEqual({
      id: 1396,
      title: "絕命毒師",
      originalTitle: "Breaking Bad",
      releaseYear: null,
      posterUrl: null,
      backdropUrl: null,
      url: "https://www.themoviedb.org/tv/1396",
    });
  });

  it("answers null for a work TMDB does not have", async () => {
    respond(JSON.stringify({ status_code: 34 }), 404);

    await expect(
      getTmdbWork(TmdbMediaType.Movie, 1, TmdbLanguage.EnUS)
    ).resolves.toBeNull();
  });
});
