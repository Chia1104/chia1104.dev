import type { Caller } from "@chia/service-kit/policies";
import { CallerTier } from "@chia/service-kit/policies";

/**
 * What the caller asked to see beyond the public set.
 *
 * Both flags are requests, not assertions: a caller below the required tier has them
 * clamped away rather than rejected, so a browser that sends `includeUnpublished` simply
 * receives the published set instead of an error.
 */
export interface FeedVisibilityRequest {
  /** Include drafts. Honoured from {@link CallerTier.ApiKey} up. */
  includeUnpublished?: boolean;
  /** Include soft-deleted feeds. Honoured from {@link CallerTier.Session} up. */
  includeDeleted?: boolean;
}

/** The effective scope, already clamped to what the tier permits. */
export interface FeedVisibility {
  /** Author whose feeds are addressable. */
  userId: string;
  /** `true` restricts to published; `undefined` applies no filter. */
  published?: true;
  enableDeleted: boolean;
}

/**
 * Largest page a tier may request.
 *
 * The anonymous cap is what stops the browser surface from being used to walk the whole
 * table in one call; `apps/www`'s sitemap asks for 1000 in one go and holds the project
 * API key, which is what the higher cap is for.
 */
const MAX_LIMIT = {
  [CallerTier.Anonymous]: 50,
  [CallerTier.ApiKey]: 1000,
  [CallerTier.Session]: 1000,
  [CallerTier.Root]: 1000,
} satisfies Record<CallerTier, number>;

export const resolveFeedLimit = (tier: CallerTier, requested: number): number =>
  Math.min(requested, MAX_LIMIT[tier]);

/**
 * Single source of truth for "who may see which feeds".
 *
 * This used to be three procedures — anonymous, API-key and session — each with its own
 * hard-coded scope, which made the rule structurally impossible to get wrong and
 * impossible to reuse. Collapsing them onto one procedure moves the rule here, so it is
 * still written exactly once; `__tests__/feeds-access.test.ts` is what now holds it in
 * place.
 */
export const resolveFeedVisibility = (
  caller: Caller,
  request: FeedVisibilityRequest = {}
): FeedVisibility => {
  const canSeeOwnDrafts = caller.tier >= CallerTier.Session;
  const canSeeDrafts = caller.tier >= CallerTier.ApiKey;

  return {
    /**
     * Below a session there is no "own" author to speak of, so the addressable set is the
     * configured admin's — this is a single-author site and the public surface never
     * accepts an author as input.
     */
    userId: canSeeOwnDrafts
      ? (caller.session?.user.id ?? caller.adminId)
      : caller.adminId,
    published: canSeeDrafts && request.includeUnpublished ? undefined : true,
    enableDeleted: Boolean(canSeeOwnDrafts && request.includeDeleted),
  };
};

/** Shape `getInfiniteFeedsByUserId` takes — the published filter goes through `whereAnd`. */
export const toFeedListScope = (visibility: FeedVisibility) => ({
  userId: visibility.userId,
  enableDeleted: visibility.enableDeleted,
  whereAnd: visibility.published ? { published: true } : {},
});

/** Shape `getFeedBySlug` / `getFeedById` take — the published filter is a plain field. */
export const toFeedDetailScope = (visibility: FeedVisibility) => ({
  userId: visibility.userId,
  published: visibility.published,
  enableDeleted: visibility.enableDeleted,
});
