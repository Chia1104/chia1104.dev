import { oc } from "@orpc/contract";
import * as z from "zod";

import { spotifyCredentialUserSchema } from "../../spotify/validator";

// ============================================
// Output Schemas
// ============================================

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
// Contracts
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
