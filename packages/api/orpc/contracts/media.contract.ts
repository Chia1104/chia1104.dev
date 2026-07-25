import { oc } from "@orpc/contract";
import * as z from "zod";

import type { CurrentPlaying, PlayList } from "../../spotify/types";

/**
 * Spotify payloads are passed straight through, so the shape is Spotify's to own.
 * `z.custom` keeps the types exact for consumers without committing us to maintaining a
 * zod mirror of their schema that breaks whenever they add a field — the trade-off is no
 * runtime validation and no response schema in the OpenAPI document.
 */
const spotifyPlaylistSchema = z.custom<PlayList>();
const spotifyNowPlayingSchema = z.custom<CurrentPlaying | null>();

/**
 * `path` keeps the URLs the Hono routes served, so the migration is invisible to callers
 * that still speak REST.
 */
export const getSpotifyPlaylistContract = oc
  .route({ method: "GET", path: "/spotify/playlist/{playlistId}" })
  .errors({
    INTERNAL_SERVER_ERROR: {},
    TOO_MANY_REQUESTS: {},
  })
  .input(z.object({ playlistId: z.string().min(1) }))
  .output(spotifyPlaylistSchema);

export const getSpotifyNowPlayingContract = oc
  .route({ method: "GET", path: "/spotify/playing" })
  .errors({
    SERVICE_UNAVAILABLE: {},
    INTERNAL_SERVER_ERROR: {},
    TOO_MANY_REQUESTS: {},
  })
  .output(spotifyNowPlayingSchema);
