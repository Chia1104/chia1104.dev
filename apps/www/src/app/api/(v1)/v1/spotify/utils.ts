import "server-only";
import { env } from "@/env.mjs";
import { post, request } from "@chia/utils";
import { type PlayList, type CurrentPlaying } from "./types";

export const SPOTIFY_BASE_URL = "https://api.spotify.com/v1";

export const spotifyRequest = request({
  prefixUrl: SPOTIFY_BASE_URL,
});

export const BASIC = Buffer.from(
  `${env.SPOTIFY_CLIENT_ID}:${env.SPOTIFY_CLIENT_SECRET}`
).toString("base64");

export const TOKEN_ENDPOINT = "https://accounts.spotify.com/api/token";

export const FAVORITE_PLAYLIST_ID = env.SPOTIFY_FAVORITE_PLAYLIST_ID;

export const getAccessToken = async () => {
  const body = env.SPOTIFY_REFRESH_TOKEN
    ? new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: env.SPOTIFY_REFRESH_TOKEN,
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
 * @default revalidate one request per day
 * @returns PlayList | null
 */
export const getPlayList = async (req?: { revalidate?: number }) => {
  req ??= {};
  const { revalidate = 60 * 60 * 24 } = req;

  const accessToken = await getAccessToken();

  const result = await spotifyRequest(`playlists/${FAVORITE_PLAYLIST_ID}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    next: {
      revalidate,
    },
  });

  return result.json<PlayList>();
};

/**
 * @description get user current playing from spotify
 * @param req { revalidate }
 * @default revalidate one request per one minutes
 * @returns CurrentPlaying
 */
export const getNowPlaying = async (req?: { revalidate?: number }) => {
  req ??= {};
  const { revalidate = 60 } = req;
  const accessToken = await getAccessToken();

  const result = await spotifyRequest("me/player/currently-playing", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    next: {
      revalidate,
    },
  });

  if (result.status === 204) {
    return null;
  }

  return result.json<CurrentPlaying>();
};
