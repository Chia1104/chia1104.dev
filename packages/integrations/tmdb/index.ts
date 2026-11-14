import * as z from "zod";

import { env } from "./env";

const API_BASE_URL = "https://api.themoviedb.org/3";
const SITE_BASE_URL = "https://www.themoviedb.org";
/** `w780` is the widest poster rendition short of the original upload. */
const POSTER_BASE_URL = "https://image.tmdb.org/t/p/w780";
/** Key art in landscape; `w1280` is the widest rendition short of the original upload. */
const BACKDROP_BASE_URL = "https://image.tmdb.org/t/p/w1280";
const REQUEST_TIMEOUT_MS = 8000;

export const TmdbMediaType = {
  Movie: "movie",
  Tv: "tv",
} as const;

export type TmdbMediaType = (typeof TmdbMediaType)[keyof typeof TmdbMediaType];

/** The languages titles are read in; TMDB falls back to the original title when it has none. */
export const TmdbLanguage = {
  ZhTW: "zh-TW",
  EnUS: "en-US",
} as const;

export type TmdbLanguage = (typeof TmdbLanguage)[keyof typeof TmdbLanguage];

export interface TmdbWork {
  id: number;
  title: string;
  originalTitle: string;
  releaseYear: number | null;
  posterUrl: string | null;
  backdropUrl: string | null;
  url: string;
}

/** A film names itself with `title` and `release_date`, a series with `name` and `first_air_date`. */
const workSchema = z.object({
  id: z.number().int(),
  title: z.string().optional(),
  name: z.string().optional(),
  original_title: z.string().optional(),
  original_name: z.string().optional(),
  release_date: z.string().nullish(),
  first_air_date: z.string().nullish(),
  poster_path: z.string().nullish(),
  backdrop_path: z.string().nullish(),
});

const searchSchema = z.object({ results: z.array(workSchema) });

const yearOf = (date: string | null | undefined) => {
  const year = Number.parseInt(date?.slice(0, 4) ?? "", 10);
  return Number.isNaN(year) ? null : year;
};

const toWork = (type: TmdbMediaType, raw: z.infer<typeof workSchema>) => {
  const title = raw.title ?? raw.name ?? "";
  return {
    id: raw.id,
    title,
    originalTitle: raw.original_title ?? raw.original_name ?? title,
    releaseYear: yearOf(raw.release_date ?? raw.first_air_date),
    posterUrl: raw.poster_path ? `${POSTER_BASE_URL}${raw.poster_path}` : null,
    backdropUrl: raw.backdrop_path
      ? `${BACKDROP_BASE_URL}${raw.backdrop_path}`
      : null,
    url: `${SITE_BASE_URL}/${type}/${raw.id}`,
  } satisfies TmdbWork;
};

const request = (
  path: string,
  params: Record<string, string>,
  signal?: AbortSignal
) => {
  const timeout = AbortSignal.timeout(REQUEST_TIMEOUT_MS);
  return fetch(`${API_BASE_URL}${path}?${new URLSearchParams(params)}`, {
    headers: {
      Authorization: `Bearer ${env.TMDB_ACCESS_TOKEN}`,
      Accept: "application/json",
    },
    signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
  });
};

export const searchTmdb = async (
  type: TmdbMediaType,
  query: string,
  language: TmdbLanguage,
  signal?: AbortSignal
): Promise<TmdbWork[]> => {
  const response = await request(
    `/search/${type}`,
    { query, language, include_adult: "false" },
    signal
  );
  if (!response.ok) {
    throw new Error(`TMDB search responded ${response.status}`);
  }
  const { results } = searchSchema.parse(await response.json());
  return results.map((raw) => toWork(type, raw));
};

/** `null` when TMDB has no such work. */
export const getTmdbWork = async (
  type: TmdbMediaType,
  id: number,
  language: TmdbLanguage,
  signal?: AbortSignal
): Promise<TmdbWork | null> => {
  const response = await request(`/${type}/${id}`, { language }, signal);
  if (response.status === 404) return null;
  if (!response.ok) {
    throw new Error(`TMDB ${type} responded ${response.status}`);
  }
  return toWork(type, workSchema.parse(await response.json()));
};
