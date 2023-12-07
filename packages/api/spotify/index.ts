import "server-only";
import { env } from "./env.mjs";
import { post, request } from "@chia/utils";
import { type PlayList, type CurrentPlaying } from "./types";

export const SPOTIFY_BASE_URL = "https://api.spotify.com/v1";

export const spotifyRequest = request({
  prefixUrl: SPOTIFY_BASE_URL,
});

const BASIC = Buffer.from(
  `${env.SPOTIFY_CLIENT_ID}:${env.SPOTIFY_CLIENT_SECRET}`
).toString("base64");

const TOKEN_ENDPOINT = "https://accounts.spotify.com/api/token";

export const FAVORITE_PLAYLIST_ID = env.SPOTIFY_FAVORITE_PLAYLIST_ID;

export const getSpotifyAccessToken = async (req?: {
  refresh_token?: string;
  revalidate?: number;
  cache?: RequestCache;
}) => {
  req ??= {};
  const { revalidate = 60 * 60 * 1, cache, refresh_token } = req;
  const body = env.SPOTIFY_REFRESH_TOKEN
    ? new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: refresh_token ?? env.SPOTIFY_REFRESH_TOKEN,
      })
    : "grant_type=client_credentials";
  const result = await post<{
    access_token: string;
  }>(
    TOKEN_ENDPOINT,
    undefined,
    {
      headers: {
        Authorization: `Basic ${BASIC}`,
      },
      body,
      cache,
      next:
        cache !== "no-store"
          ? {
              revalidate,
            }
          : undefined,
    },
    {
      hooks: {
        beforeRequest: [
          (request) => {
            request.headers.set(
              "Content-Type",
              "application/x-www-form-urlencoded"
            );
          },
        ],
      },
    }
  );

  return result.access_token;
};

/**
 * @description get favorite playlist from spotify
 * @param req { revalidate }
 * @default revalidate one request per one hour
 * @returns PlayList
 */
export const getPlayList = async (req?: {
  playlistId?: string;
  revalidate?: number;
  tokenRequestCache?: RequestCache;
}) => {
  req ??= {};
  const { revalidate = 60 * 60 * 1, tokenRequestCache, playlistId } = req;

  if (revalidate < 0) {
    throw new Error("revalidate must be positive");
  }

  const accessToken = await getSpotifyAccessToken({
    cache: tokenRequestCache,
    revalidate,
  });

  const result = await spotifyRequest(
    `playlists/${playlistId ?? FAVORITE_PLAYLIST_ID}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      next: {
        revalidate,
      },
    }
  );

  return result.json<PlayList>();
};

/**
 * @todo implement Authorization code PKCE
 * @description get user current playing from spotify
 * @param req { revalidate }
 * @default revalidate one request per one minutes
 * @returns CurrentPlaying | null
 */
export const getNowPlaying = async (req?: {
  revalidate?: number;
  cache?: RequestCache;
}) => {
  req ??= {};
  const { revalidate = 60, cache } = req;
  const accessToken = await getSpotifyAccessToken({
    revalidate,
  });

  const result = await spotifyRequest("me/player/currently-playing", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    cache,
    next:
      cache !== "no-store"
        ? {
            revalidate,
          }
        : undefined,
  });

  if (result.status === 204) {
    return null;
  }

  return result.json<CurrentPlaying>();
};
