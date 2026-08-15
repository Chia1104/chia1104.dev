import { oc } from "@orpc/contract";
import * as z from "zod";

import type { CurrentPlaying, PlayList } from "../../spotify/types";
import { spotifyCredentialUserSchema } from "../../spotify/validator";

/**
 * The whole Spotify surface: the public playback reads the site renders, and the account
 * management the operator drives. They used to sit in two top-level namespaces (`media`
 * and `spotify`) that each held exactly one child.
 */

// ============================================
// Output Schemas
// ============================================

/**
 * Spotify payloads are passed straight through, so the shape is Spotify's to own.
 * `z.custom` keeps the types exact for consumers without committing us to maintaining a
 * zod mirror of their schema that breaks whenever they add a field — the trade-off is no
 * runtime validation.
 */
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

// ============================================
// Playback
// ============================================

/**
 * Only `apps/www`'s server-side client reads the playlist, so it sits behind the project
 * API key.
 */
export const getSpotifyPlaylistContract = oc
  .errors({
    UNAUTHORIZED: {},
    FORBIDDEN: {},
    INTERNAL_SERVER_ERROR: {},
    TOO_MANY_REQUESTS: {},
  })
  .input(z.object({ playlistId: z.string().min(1) }))
  .output(spotifyPlaylistSchema);

/**
 * Reached from the browser, so it stays public.
 */
export const getSpotifyNowPlayingContract = oc
  .errors({
    SERVICE_UNAVAILABLE: {},
    INTERNAL_SERVER_ERROR: {},
    TOO_MANY_REQUESTS: {},
  })
  .output(spotifyNowPlayingSchema);

// ============================================
// Account management (admin)
// ============================================

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
