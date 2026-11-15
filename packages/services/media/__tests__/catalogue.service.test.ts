import { beforeEach, describe, expect, it, vi } from "vitest";

import { MediaSource } from "@chia/db/types";

import { resolveMediaSnapshot } from "../catalogue.service";
import { mediaSlugCandidates } from "../slug";

const { anilist } = vi.hoisted(() => ({
  anilist: { getAnilistAnime: vi.fn(), searchAnilistAnime: vi.fn() },
}));

vi.mock("@chia/integrations/anilist", () => anilist);

const anime = {
  id: 154587,
  titles: {
    romaji: "Sousou no Frieren",
    english: "Frieren: Beyond Journey’s End",
    native: "葬送のフリーレン",
  },
  releaseYear: 2023,
  coverUrl: "https://s4.anilist.co/cover.jpg",
  bannerUrl: "https://s4.anilist.co/banner.jpg",
  color: "#d6e4a1",
  url: "https://anilist.co/anime/154587",
};

describe("resolveMediaSnapshot", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("drops a catalogue colour that is not #rrggbb", async () => {
    anilist.getAnilistAnime.mockResolvedValueOnce({ ...anime, color: "teal" });
    const snapshot = await resolveMediaSnapshot(MediaSource.Anilist, "154587");
    expect(snapshot?.color).toBeNull();

    anilist.getAnilistAnime.mockResolvedValueOnce(anime);
    await expect(
      resolveMediaSnapshot(MediaSource.Anilist, "154587")
    ).resolves.toMatchObject({ color: "#d6e4a1" });
  });

  it("treats a work whose titles are all blank as unknown", async () => {
    anilist.getAnilistAnime.mockResolvedValueOnce({
      ...anime,
      titles: { romaji: null, english: "  ", native: null },
    });
    await expect(
      resolveMediaSnapshot(MediaSource.Anilist, "154587")
    ).resolves.toBeNull();
  });

  it("refuses an id no catalogue could have issued without calling one", async () => {
    await expect(
      resolveMediaSnapshot(MediaSource.Anilist, "1 OR 1=1")
    ).resolves.toBeNull();
    expect(anilist.getAnilistAnime).not.toHaveBeenCalled();
  });
});

describe("mediaSlugCandidates", () => {
  it("prefers the English title, then adds the year, then the catalogue id", () => {
    expect(
      mediaSlugCandidates(
        {
          translations: { en: { title: "Frieren: Beyond Journey’s End" } },
          originalTitle: "葬送のフリーレン",
          releaseYear: 2023,
        },
        MediaSource.Anilist,
        "154587"
      )
    ).toEqual([
      "frieren-beyond-journeys-end",
      "frieren-beyond-journeys-end-2023",
      "frieren-beyond-journeys-end-anilist-154587",
    ]);
  });

  it("falls back to the catalogue id when no title slugifies", () => {
    expect(
      mediaSlugCandidates(
        { translations: {}, originalTitle: "!!!", releaseYear: null },
        MediaSource.TmdbMovie,
        "603"
      )
    ).toEqual(["tmdb-movie-603"]);
  });
});
