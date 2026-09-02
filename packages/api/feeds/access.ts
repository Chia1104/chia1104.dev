import type { Caller } from "@chia/service-kit/policies/caller.policy";
import { CallerTier } from "@chia/service-kit/policies/caller.policy";

/**
 * A caller below the required tier has flags clamped away rather than rejected, so a
 * browser that sends `includeUnpublished` receives the published set.
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
 * Largest page a tier may request. The anonymous cap stops the browser from walking the
 * whole table; `apps/www`'s sitemap asks for 1000 with `apps/www`'s API key.
 */
const MAX_LIMIT = {
  [CallerTier.Anonymous]: 50,
  [CallerTier.Guest]: 50,
  [CallerTier.ApiKey]: 1000,
  [CallerTier.Session]: 1000,
  [CallerTier.Root]: 1000,
} satisfies Record<CallerTier, number>;

export const resolveFeedLimit = (tier: CallerTier, requested: number): number =>
  Math.min(requested, MAX_LIMIT[tier]);

/** Who may see which feeds. `__tests__/feeds-access.test.ts` pins the clamp. */
export const resolveFeedVisibility = (
  caller: Caller,
  request: FeedVisibilityRequest = {}
): FeedVisibility => {
  const canSeeOwnDrafts = caller.tier >= CallerTier.Session;
  const canSeeDrafts = caller.tier >= CallerTier.ApiKey;

  return {
    /**
     * Below a session there is no "own" author, so the addressable set is the configured
     * admin's. The public surface never accepts an author as input.
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
