import * as z from "zod";

import { env } from "./env";

const API_URL = "https://api.igdb.com/v4/games";
const TOKEN_URL = "https://id.twitch.tv/oauth2/token";
/** `t_cover_big_2x` is 528×748, the largest portrait cover rendition. */
const COVER_BASE_URL =
  "https://images.igdb.com/igdb/image/upload/t_cover_big_2x";
/** Landscape key art and screenshots at 1920×1080. */
const ARTWORK_BASE_URL = "https://images.igdb.com/igdb/image/upload/t_1080p";
const REQUEST_TIMEOUT_MS = 8000;
const SEARCH_LIMIT = 10;
/** A token is dropped this long before Twitch expires it, so a request never carries a dying one. */
const TOKEN_EXPIRY_MARGIN_MS = 60_000;

export interface IgdbGame {
  id: number;
  name: string;
  releaseYear: number | null;
  coverUrl: string | null;
  /** Key art when the game has any, else its first screenshot. */
  artworkUrl: string | null;
  /** The game's id on Steam, when IGDB links its store page. */
  steamAppId: number | null;
  url: string;
}

const GAME_FIELDS =
  "fields name,first_release_date,cover.image_id,artworks.image_id,screenshots.image_id,websites.url,url;";

const imageSchema = z.object({ image_id: z.string() });

const gameSchema = z.object({
  id: z.number().int(),
  name: z.string(),
  /** Unix seconds. */
  first_release_date: z.number().optional(),
  cover: imageSchema.optional(),
  artworks: z.array(imageSchema).optional(),
  screenshots: z.array(imageSchema).optional(),
  websites: z.array(z.object({ url: z.string() })).optional(),
  url: z.string(),
});

const tokenSchema = z.object({
  access_token: z.string(),
  /** Seconds. */
  expires_in: z.number(),
});

/** Read from the store URL itself, which names the app whatever IGDB calls the link. */
const STEAM_STORE_APP = /store\.steampowered\.com\/app\/(\d+)/;

const steamAppIdOf = (websites: readonly { url: string }[]) => {
  for (const website of websites) {
    const id = STEAM_STORE_APP.exec(website.url)?.[1];
    if (id) return Number(id);
  }
  return null;
};

const toGame = (raw: z.infer<typeof gameSchema>): IgdbGame => {
  const artwork = raw.artworks?.[0] ?? raw.screenshots?.[0];
  return {
    id: raw.id,
    name: raw.name,
    releaseYear:
      raw.first_release_date === undefined
        ? null
        : new Date(raw.first_release_date * 1000).getUTCFullYear(),
    coverUrl: raw.cover ? `${COVER_BASE_URL}/${raw.cover.image_id}.jpg` : null,
    artworkUrl: artwork ? `${ARTWORK_BASE_URL}/${artwork.image_id}.jpg` : null,
    steamAppId: steamAppIdOf(raw.websites ?? []),
    url: raw.url,
  };
};

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
