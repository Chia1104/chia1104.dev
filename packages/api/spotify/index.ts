import { post, request } from "@chia/utils";

import { env } from "./env";
import type { PlayList, CurrentPlaying } from "./types";
import type {
  GenerateAuthorizeUrlDTO,
  CodeAuthorizationDTO,
} from "./validator";

interface NextFetchRequestConfig {
  revalidate?: number | false;
  tags?: string[];
}

type RequestCache =
  | "default"
  | "force-cache"
  | "no-cache"
  | "no-store"
  | "only-if-cached"
  | "reload";

declare module "ky" {
  interface Options {
    next?: NextFetchRequestConfig | undefined;
    cache?: RequestCache;
  }
}

export const SPOTIFY_BASE_URL = "https://api.spotify.com/v1";

export const spotifyRequest = request({
  prefixUrl: SPOTIFY_BASE_URL,
});

const BASIC = Buffer.from(
  `${env.SPOTIFY_CLIENT_ID}:${env.SPOTIFY_CLIENT_SECRET}`
).toString("base64");

const ACCOUNT_ENDPOINT = "https://accounts.spotify.com";

export const FAVORITE_PLAYLIST_ID = env.SPOTIFY_FAVORITE_PLAYLIST_ID;

export const getSpotifyAccessToken = async (req?: {
  refresh_token?: string;
  revalidate?: number;
  cache?: RequestCache;
  grant_type?: "refresh_token" | "client_credentials";
}) => {
  req ??= {};
  const { revalidate = 60 * 60 * 1, cache, refresh_token, grant_type } = req;
  const body =
    grant_type === "refresh_token"
      ? new URLSearchParams({
          grant_type: "refresh_token",
          refresh_token: refresh_token ?? env.SPOTIFY_REFRESH_TOKEN ?? "",
        })
      : "grant_type=client_credentials";
  const result = await post<{
    access_token: string;
  }>(
    `${ACCOUNT_ENDPOINT}/api/token`,
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
    grant_type: "refresh_token",
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

export const generateAuthorizeUrl = (dto: GenerateAuthorizeUrlDTO) => {
  const clientId = env.SPOTIFY_CLIENT_ID;
  const url = new URL("https://accounts.spotify.com/authorize");
  url.searchParams.append("client_id", clientId);
  url.searchParams.append("response_type", "code");
  url.searchParams.append("redirect_uri", dto.redirectUri);
  url.searchParams.append("state", dto.state);
  url.searchParams.append("scope", dto.scopes.join(" "));
  return url.toString();
};

export const codeAuthorization = (dto: CodeAuthorizationDTO) => {
  return post<{
    access_token: string;
    token_type: string;
    expires_in: number;
    refresh_token: string;
    scope: string;
  }>(`${ACCOUNT_ENDPOINT}/api/token`, undefined, {
    headers: {
      Authorization: `Basic ${BASIC}`,
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code: dto.code,
      redirect_uri: dto.redirectUri,
    }),
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
  });
};
