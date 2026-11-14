import * as z from "zod";

import { env } from "./env";

const API_URL = "https://api.igdb.com/v4/games";
const TOKEN_URL = "https://id.twitch.tv/oauth2/token";
/** `t_cover_big_2x` is 528×748, the largest portrait cover rendition. */
const COVER_BASE_URL =
  "https://images.igdb.com/igdb/image/upload/t_cover_big_2x";
const REQUEST_TIMEOUT_MS = 8000;
const SEARCH_LIMIT = 10;
/** A token is dropped this long before Twitch expires it, so a request never carries a dying one. */
const TOKEN_EXPIRY_MARGIN_MS = 60_000;

export interface IgdbGame {
  id: number;
  name: string;
  releaseYear: number | null;
  coverUrl: string | null;
  url: string;
}

const GAME_FIELDS = "fields name,first_release_date,cover.image_id,url;";

const gameSchema = z.object({
  id: z.number().int(),
  name: z.string(),
  /** Unix seconds. */
  first_release_date: z.number().optional(),
  cover: z.object({ image_id: z.string() }).optional(),
  url: z.string(),
});

const tokenSchema = z.object({
  access_token: z.string(),
  /** Seconds. */
  expires_in: z.number(),
});

const toGame = (raw: z.infer<typeof gameSchema>): IgdbGame => ({
  id: raw.id,
  name: raw.name,
  releaseYear:
    raw.first_release_date === undefined
      ? null
      : new Date(raw.first_release_date * 1000).getUTCFullYear(),
  coverUrl: raw.cover ? `${COVER_BASE_URL}/${raw.cover.image_id}.jpg` : null,
  url: raw.url,
});

const withTimeout = (signal?: AbortSignal) => {
  const timeout = AbortSignal.timeout(REQUEST_TIMEOUT_MS);
  return signal ? AbortSignal.any([signal, timeout]) : timeout;
};

let cachedToken: { value: string; expiresAt: number } | null = null;

/** An app access token from Twitch's client-credentials grant, reused until it nears expiry. */
const getAccessToken = async (signal?: AbortSignal) => {
  if (cachedToken && cachedToken.expiresAt > Date.now()) {
    return cachedToken.value;
  }
  const response = await fetch(TOKEN_URL, {
    method: "POST",
    body: new URLSearchParams({
      client_id: env.IGDB_CLIENT_ID,
      client_secret: env.IGDB_CLIENT_SECRET,
      grant_type: "client_credentials",
    }),
    signal: withTimeout(signal),
  });
  if (!response.ok) {
    throw new Error(`Twitch token responded ${response.status}`);
  }
  const token = tokenSchema.parse(await response.json());
  cachedToken = {
    value: token.access_token,
    expiresAt: Date.now() + token.expires_in * 1000 - TOKEN_EXPIRY_MARGIN_MS,
  };
  return cachedToken.value;
};

/** `body` is an Apicalypse query. */
const request = async (body: string, signal?: AbortSignal) => {
  const response = await fetch(API_URL, {
    method: "POST",
    headers: {
      "Client-ID": env.IGDB_CLIENT_ID,
      Authorization: `Bearer ${await getAccessToken(signal)}`,
      Accept: "application/json",
    },
    body,
    signal: withTimeout(signal),
  });
  if (!response.ok) {
    throw new Error(`IGDB responded ${response.status}`);
  }
  return z
    .array(gameSchema)
    .parse(await response.json())
    .map(toGame);
};

export const searchIgdbGames = (
  query: string,
  signal?: AbortSignal
): Promise<IgdbGame[]> =>
  // Apicalypse strings are double-quoted; a quote or backslash in the query would end the string.
  request(
    `search "${query.replaceAll(/["\\]/g, " ")}"; ${GAME_FIELDS} limit ${SEARCH_LIMIT};`,
    signal
  );

/** `null` when IGDB has no such game. */
export const getIgdbGame = async (
  id: number,
  signal?: AbortSignal
): Promise<IgdbGame | null> => {
  const [game] = await request(`${GAME_FIELDS} where id = ${id};`, signal);
  return game ?? null;
};
