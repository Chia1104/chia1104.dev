import type { NextRequest } from "next/server";
import { env } from "@/env";
import { getAdminId } from "@chia/utils";

export const getRedirectUri = (req: NextRequest) => {
  return (
    env.SPOTIFY_REDIRECT_URI ??
    `${req.nextUrl.protocol}//${req.nextUrl.host}/oauth/spotify/callback`
  );
};

export const getSiteUrl = (req: NextRequest) => {
  if (env.SPOTIFY_REDIRECT_URI) {
    const url = new URL(env.SPOTIFY_REDIRECT_URI);
    return `${url.protocol}//${url.host}`;
  }
  return `${req.nextUrl.protocol}//${req.nextUrl.host}`;
};

export const SPOTIFY_OAUTH_RESULT = `${getAdminId()}:spotify-oauth-result`;

export const SPOTIFY_OAUTH_STATE = `${getAdminId()}:spotify-oauth-state`;
