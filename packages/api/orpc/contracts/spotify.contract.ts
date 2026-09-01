import { oc } from "@orpc/contract";
import * as z from "zod";

import type { CurrentPlaying, PlayList } from "../../spotify/types";
import { spotifyCredentialUserSchema } from "../../spotify/validator";

/**
 * Public playback plus operator account management.
 */

/** Spotify owns the payload shape; `z.custom` keeps types exact with no runtime validation. */
const spotifyPlaylistSchema = z.custom<PlayList>();
const spotifyNowPlayingSchema = z.custom<CurrentPlaying | null>();

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

/** Only `apps/www`'s server-side client reads the playlist, so it sits behind the project API key. */
export const getSpotifyPlaylistContract = oc
  .errors({
    UNAUTHORIZED: {},
    FORBIDDEN: {},
    INTERNAL_SERVER_ERROR: {},
    TOO_MANY_REQUESTS: {},
  })
  .input(z.object({ playlistId: z.string().min(1) }))
  .output(spotifyPlaylistSchema);

/** Reached from the browser, so it stays public. */
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
