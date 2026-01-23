import type { InferResponseType } from "hono";

import { client } from "@/libs/service/client";
import { HonoRPCError } from "@/libs/service/error";

export type CurrentPlayingResponse = InferResponseType<
  typeof client.api.v1.spotify.playing.$get,
  200
>;

export const getCurrentPlaying = async ({
  signal,
}: {
  signal: AbortSignal;
}) => {
  try {
    const response = await client.api.v1.spotify.playing.$get({ signal });
    if (!response.ok) {
      throw new HonoRPCError(
        response.statusText,
        response.status,
        response.statusText
      );
    }
    return response.json();
  } catch (error) {
    if (error instanceof HonoRPCError) {
      throw error;
    }
    throw new HonoRPCError(
      "INTERNAL_SERVER_ERROR",
      500,
      "Internal server error"
    );
  }
};
