import type { InferResponseType } from "hono";

import { client } from "@/libs/service/client";
import { HonoRPCError } from "@/libs/service/error";

const accountsEndpoint = client.api.v1.spotify.manage.accounts;

export type SpotifyAccountsResponse = InferResponseType<
  typeof accountsEndpoint.$get,
  200
>;

const assertResponse = (response: Response) => {
  if (!response.ok) {
    throw new HonoRPCError(
      response.statusText,
      response.status,
      response.statusText
    );
  }
};

export const getSpotifyAccounts = async () => {
  const response = await accountsEndpoint.$get();
  assertResponse(response);
  return response.json();
};

export const createSpotifyAuthorization = async () => {
  const response = await client.api.v1.spotify.manage.authorize.$post();
  assertResponse(response);
  const data = await response.json();
  if (!("url" in data)) {
    throw new HonoRPCError(
      "INVALID_RESPONSE",
      500,
      "Spotify authorization URL is missing"
    );
  }
  return data;
};

export const activateSpotifyAccount = async (userId: string) => {
  const response = await accountsEndpoint[":userId"].activate.$post({
    param: {
      userId,
    },
  });
  assertResponse(response);
  return response.json();
};

export const disconnectSpotifyAccount = async () => {
  const response = await client.api.v1.spotify.manage.account.$delete();
  assertResponse(response);
};
