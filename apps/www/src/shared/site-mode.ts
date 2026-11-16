import meta from "@chia/meta";

/**
 * The two faces of the site. A mode is a URL space with its own frame, so the route decides it;
 * nothing stores it.
 */
export const SiteMode = {
  Tech: "tech",
  Hobby: "hobby",
} as const;

export type SiteMode = (typeof SiteMode)[keyof typeof SiteMode];

/** Where each mode starts; the mode switch links here. */
export const SITE_MODE_HOME = {
  [SiteMode.Tech]: "/",
  [SiteMode.Hobby]: "/hobby",
} as const satisfies Record<SiteMode, string>;

/** The portrait each mode wears; the mode switch shows its own mode's and previews the other's. */
export const SITE_MODE_FACE = {
  [SiteMode.Tech]: meta.avatar,
  [SiteMode.Hobby]: meta.secondaryAvatar,
} as const satisfies Record<SiteMode, string>;

/** The mode a pathname without its locale prefix belongs to. */
export const siteModeOf = (pathname: string): SiteMode =>
  pathname === SITE_MODE_HOME[SiteMode.Hobby] ||
  pathname.startsWith(`${SITE_MODE_HOME[SiteMode.Hobby]}/`)
    ? SiteMode.Hobby
    : SiteMode.Tech;

export const otherSiteModeOf = (mode: SiteMode): SiteMode =>
  mode === SiteMode.Tech ? SiteMode.Hobby : SiteMode.Tech;
