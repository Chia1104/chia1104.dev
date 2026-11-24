/** How much the caller has proven, ordered so tiers can be compared. */
export const CallerTier = {
  Anonymous: 0,
  /** Session cookie for a guest who passed the captcha but never signed in. Below ApiKey. */
  Guest: 1,
  /** Valid `X-CH-API-KEY`. */
  ApiKey: 2,
  /** Valid session cookie for a signed-in person. */
  Session: 3,
  /** Session of the configured admin. */
  Root: 4,
} as const;

export type CallerTier = (typeof CallerTier)[keyof typeof CallerTier];

export const isCallerTier = (value: number): value is CallerTier =>
  Object.values<number>(CallerTier).includes(value);

/** What a session proves about its user; the shape both the auth routes and the policies read. */
export interface TieredUser {
  id: string;
  isAnonymous: boolean;
}

/** The configured admin is the only Root; no column on the user row can grant it. */
export const tierForUser = (user: TieredUser, adminId: string): CallerTier => {
  if (user.isAnonymous) return CallerTier.Guest;
  return user.id === adminId ? CallerTier.Root : CallerTier.Session;
};

/**
 * The tier an agent kind admits: the operator may raise the definition's floor, never
 * lower it, so a kind is never opened wider than its code was written for.
 */
export const agentKindFloor = (
  code: CallerTier,
  override: number | null | undefined
): CallerTier => {
  if (override === null || override === undefined || !isCallerTier(override)) {
    return code;
  }
  return override > code ? override : code;
};
