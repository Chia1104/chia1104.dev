import { DASH_BASE_URL } from "@chia/utils/config";

export const getSpotifyDashboardRedirect = (status: string) => {
  const url = new URL("/settings/spotify", DASH_BASE_URL);
  url.searchParams.set("spotify", status);
  return url.toString();
};
