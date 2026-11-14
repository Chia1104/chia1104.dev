import { afterEach, describe, expect, it, vi } from "vitest";

import { getAnilistAnime, searchAnilistAnime } from ".";

const media = {
  id: 154587,
  title: {
    romaji: "Sousou no Frieren",
    english: "Frieren: Beyond Journey’s End",
    native: "葬送のフリーレン",
  },
  startDate: { year: 2023 },
  coverImage: {
    extraLarge: "https://img.example/frieren.jpg",
    color: "#d6e4a1",
  },
  bannerImage: "https://img.example/frieren-banner.jpg",
  siteUrl: "https://anilist.co/anime/154587",
};

/** `json` is the response body, already serialised. */
const respond = (json: string, status = 200) =>
  vi
    .spyOn(globalThis, "fetch")
    .mockResolvedValue(new Response(json, { status }));

describe("AniList", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("searches anime and maps each result", async () => {
    const fetchMock = respond(
      JSON.stringify({ data: { Page: { media: [media] } } })
    );

    await expect(searchAnilistAnime("frieren")).resolves.toEqual([
      {
        id: 154587,
        titles: media.title,
        releaseYear: 2023,
        coverUrl: "https://img.example/frieren.jpg",
        bannerUrl: "https://img.example/frieren-banner.jpg",
        color: "#d6e4a1",
        url: "https://anilist.co/anime/154587",
      },
    ]);
    const [, init] = fetchMock.mock.calls[0] ?? [];
    expect(JSON.parse(String(init?.body)).variables).toMatchObject({
      search: "frieren",
    });
  });

  it("answers null for an anime AniList does not have", async () => {
    respond(
      JSON.stringify({ data: { Media: null }, errors: [{ status: 404 }] }),
      404
    );

    await expect(getAnilistAnime(1)).resolves.toBeNull();
  });

  it("throws when AniList fails", async () => {
    respond(JSON.stringify({}), 500);

    await expect(searchAnilistAnime("frieren")).rejects.toThrow("500");
  });
});
