import {
  activateSpotifyAccountService,
  createSpotifyAuthorizationService,
  disconnectSpotifyAccountService,
  getSpotifyAccountsService,
  SpotifyCredentialNotFoundError,
  SpotifyCredentialUnavailableError,
} from "../../spotify/account";
import { adminGuard } from "../guards/admin.guard";
import { contractOS } from "../utils";

/**
 * Authenticated + role ∈ {Admin, Root}, but **not** pinned to the single configured
 * admin id — any admin may manage the connected Spotify accounts.
 */
const spotifyManageGuard = adminGuard({ pinToAdminId: false });

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
