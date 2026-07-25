import { DASH_BASE_URL } from "@chia/utils/config";

/**
 * Token resolution and the Spotify read APIs now live in `@chia/api/spotify/playback`,
 * next to the oRPC procedures that serve them. What stays here is the one piece that is
 * genuinely HTTP-shaped: where to send the browser after the OAuth callback.
 */
export const getSpotifyDashboardRedirect = (status: string) => {
  const url = new URL("/settings/spotify", DASH_BASE_URL);
  url.searchParams.set("spotify", status);
  return url.toString();
};
