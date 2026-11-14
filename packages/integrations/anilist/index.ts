import * as z from "zod";

const API_URL = "https://graphql.anilist.co";
const REQUEST_TIMEOUT_MS = 8000;
const SEARCH_LIMIT = 10;

export interface AnilistAnime {
  id: number;
  /** AniList keeps no Chinese title; `native` is the Japanese one. */
  titles: {
    romaji: string | null;
    english: string | null;
    native: string | null;
  };
  releaseYear: number | null;
  coverUrl: string | null;
  url: string;
}

const MEDIA_FIELDS = `
  id
  title { romaji english native }
  startDate { year }
  coverImage { extraLarge }
  siteUrl
`;

const SEARCH_QUERY = `query ($search: String, $perPage: Int) {
  Page(perPage: $perPage) {
    media(search: $search, type: ANIME, sort: SEARCH_MATCH) {${MEDIA_FIELDS}}
  }
}`;

const MEDIA_QUERY = `query ($id: Int) {
  Media(id: $id, type: ANIME) {${MEDIA_FIELDS}}
}`;

const mediaSchema = z.object({
  id: z.number().int(),
  title: z.object({
    romaji: z.string().nullable(),
    english: z.string().nullable(),
    native: z.string().nullable(),
  }),
  startDate: z.object({ year: z.number().int().nullable() }),
  coverImage: z.object({ extraLarge: z.string().nullable() }),
  siteUrl: z.string(),
});

const searchSchema = z.object({
  data: z.object({ Page: z.object({ media: z.array(mediaSchema) }) }),
});

const mediaResponseSchema = z.object({
  data: z.object({ Media: mediaSchema.nullable() }),
});

const toAnime = (raw: z.infer<typeof mediaSchema>): AnilistAnime => ({
  id: raw.id,
  titles: raw.title,
  releaseYear: raw.startDate.year,
  coverUrl: raw.coverImage.extraLarge,
  url: raw.siteUrl,
});

const request = (
  query: string,
  variables: Record<string, string | number>,
  signal?: AbortSignal
) => {
  const timeout = AbortSignal.timeout(REQUEST_TIMEOUT_MS);
  return fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ query, variables }),
    signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
  });
};

export const searchAnilistAnime = async (
  query: string,
  signal?: AbortSignal
): Promise<AnilistAnime[]> => {
  const response = await request(
    SEARCH_QUERY,
    { search: query, perPage: SEARCH_LIMIT },
    signal
  );
  if (!response.ok) {
    throw new Error(`AniList search responded ${response.status}`);
  }
  return searchSchema.parse(await response.json()).data.Page.media.map(toAnime);
};

/** `null` when AniList has no such anime; it answers 404 with `Media: null`. */
export const getAnilistAnime = async (
  id: number,
  signal?: AbortSignal
): Promise<AnilistAnime | null> => {
  const response = await request(MEDIA_QUERY, { id }, signal);
  if (response.status === 404) return null;
  if (!response.ok) {
    throw new Error(`AniList media responded ${response.status}`);
  }
  const { Media } = mediaResponseSchema.parse(await response.json()).data;
  return Media ? toAnime(Media) : null;
};
