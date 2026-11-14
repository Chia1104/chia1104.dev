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
