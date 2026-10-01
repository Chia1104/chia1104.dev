import { oc } from "@orpc/contract";
import * as z from "zod";

import type { PlayList } from "@chia/integrations/spotify/types";
import { spotifyCredentialUserSchema } from "@chia/integrations/spotify/validator";

/**
 * Public playback plus operator account management.
 */

/** Spotify owns the payload shape; `z.custom` keeps types exact with no runtime validation. */
const spotifyPlaylistSchema = z.custom<PlayList>();

/** Null when nothing a visitor can open is playing, such as an ad or a podcast. */
const spotifyNowPlayingSchema = z
  .object({
    track: z.object({
      name: z.string(),
      url: z.string(),
      artists: z.array(z.string()),
      album: z.string(),
      imageUrl: z.string().nullable(),
      durationMs: z.number(),
    }),
    isPlaying: z.boolean(),
    progressMs: z.number(),
    /** Epoch ms `progressMs` was read at; while playing, readers advance it from here. */
    observedAt: z.number(),
  })
  .nullable();

export type SpotifyNowPlaying = z.infer<typeof spotifyNowPlayingSchema>;

const spotifyAccountSchema = z.object({
  userId: z.string(),
  adminName: z.string(),
  adminImage: z.string().nullable(),
  spotifyUserId: z.string(),
  spotifyDisplayName: z.string().nullable(),
  spotifyImageUrl: z.string().nullable(),
  accessTokenExpiresAt: z.string(),
  scope: z.string(),
  isActive: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

const spotifyAccountsSchema = z.object({
  currentUserId: z.string(),
  accounts: z.array(spotifyAccountSchema),
});

const spotifyAuthorizationSchema = z.object({
  url: z.string(),
});

const spotifyActivateSchema = z.object({
  userId: z.string(),
  isActive: z.boolean(),
});

/** Only `apps/www`'s server-side client reads the playlist, so it sits behind the API key tier. */
export const getSpotifyPlaylistContract = oc
  .errors({
    UNAUTHORIZED: {},
    FORBIDDEN: {},
    INTERNAL_SERVER_ERROR: {},
    TOO_MANY_REQUESTS: {},
  })
  .input(z.object({ playlistId: z.string().min(1) }))
  .output(spotifyPlaylistSchema);

/** Reached from the browser, so it stays public; a shared read, see `shared/shared-reads.ts`. */
export const getSpotifyNowPlayingContract = oc
  .errors({
    SERVICE_UNAVAILABLE: {},
    INTERNAL_SERVER_ERROR: {},
    TOO_MANY_REQUESTS: {},
  })
  .output(spotifyNowPlayingSchema);

export const getSpotifyAccountsContract = oc
  .errors({
    UNAUTHORIZED: {},
    FORBIDDEN: {},
    INTERNAL_SERVER_ERROR: {},
  })
  .output(spotifyAccountsSchema);

export const createSpotifyAuthorizationContract = oc
  .errors({
    UNAUTHORIZED: {},
    FORBIDDEN: {},
    SERVICE_UNAVAILABLE: {},
    INTERNAL_SERVER_ERROR: {},
  })
  .output(spotifyAuthorizationSchema);

export const activateSpotifyAccountContract = oc
  .errors({
    UNAUTHORIZED: {},
    FORBIDDEN: {},
    NOT_FOUND: {},
    INTERNAL_SERVER_ERROR: {},
  })
  .input(spotifyCredentialUserSchema)
  .output(spotifyActivateSchema);

export const disconnectSpotifyAccountContract = oc.errors({
  UNAUTHORIZED: {},
  FORBIDDEN: {},
  INTERNAL_SERVER_ERROR: {},
});

export const spotifyContract = {
  playlist: getSpotifyPlaylistContract,
  playing: getSpotifyNowPlayingContract,
  accounts: getSpotifyAccountsContract,
  authorize: createSpotifyAuthorizationContract,
  activate: activateSpotifyAccountContract,
  disconnect: disconnectSpotifyAccountContract,
};
