import { Role } from "@chia/db/types";

import {
  activateSpotifyAccountService,
  createSpotifyAuthorizationService,
  disconnectSpotifyAccountService,
  getSpotifyAccountsService,
  SpotifyCredentialNotFoundError,
  SpotifyCredentialUnavailableError,
} from "../../spotify/account";
import { baseOS, contractOS } from "../utils";

const SPOTIFY_ADMIN_ROLES = new Set<string>([Role.Admin, Role.Root]);

/**
 * Authenticated + role ∈ {Admin, Root}. Intentionally NOT `adminGuard`, which
 * additionally pins the session to the single configured admin id.
 */
const spotifyManageGuard = baseOS
  .errors({
    UNAUTHORIZED: {},
    FORBIDDEN: {},
  })
  .middleware(async ({ next, context, errors }) => {
    const sessionData =
      context.session ??
      (await context.auth?.api.getSession({
        headers: context.headers,
      }));

    if (!sessionData?.session || !sessionData?.user) {
      if (context.hooks?.onUnauthorized) {
        context.hooks.onUnauthorized(errors.UNAUTHORIZED());
      }
      throw errors.UNAUTHORIZED();
    }

    if (!SPOTIFY_ADMIN_ROLES.has(sessionData.user.role)) {
      if (context.hooks?.onForbidden) {
        context.hooks.onForbidden(errors.FORBIDDEN());
      }
      throw errors.FORBIDDEN();
    }

    return next({
      context: {
        session: sessionData,
      },
    });
  });

export const getSpotifyAccountsRoute = contractOS.spotify.manage.accounts
  .use(spotifyManageGuard)
  .handler(async (opts) => {
    return getSpotifyAccountsService(
      opts.context.db,
      opts.context.session.user.id
    );
  });

export const createSpotifyAuthorizationRoute =
  contractOS.spotify.manage.authorize
    .use(spotifyManageGuard)
    .handler(async (opts) => {
      if (!opts.context.kv) {
        throw opts.errors.SERVICE_UNAVAILABLE();
      }

      try {
        const url = await createSpotifyAuthorizationService(
          opts.context.kv,
          opts.context.session.user.id
        );
        return { url };
      } catch (err) {
        if (err instanceof SpotifyCredentialUnavailableError) {
          throw opts.errors.SERVICE_UNAVAILABLE();
        }
        throw err;
      }
    });

export const activateSpotifyAccountRoute = contractOS.spotify.manage.activate
  .use(spotifyManageGuard)
  .handler(async (opts) => {
    try {
      return await activateSpotifyAccountService(
        opts.context.db,
        opts.input.userId
      );
    } catch (err) {
      if (err instanceof SpotifyCredentialNotFoundError) {
        throw opts.errors.NOT_FOUND();
      }
      throw err;
    }
  });

export const disconnectSpotifyAccountRoute =
  contractOS.spotify.manage.disconnect
    .use(spotifyManageGuard)
    .handler(async (opts) => {
      await disconnectSpotifyAccountService(
        opts.context.db,
        opts.context.session.user.id
      );
    });
