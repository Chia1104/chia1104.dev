import createMiddleware from "next-intl/middleware";

import { routing } from "./i18n/routing";

export default createMiddleware({
  locales: routing.locales,
  defaultLocale: routing.defaultLocale,
  localePrefix: "never",
});

export const config = {
  // Match only internationalized pathnames
  matcher: ["/", `/(zh-tw|en)/:path*`, "/((?!api|_next|_vercel|assets).*)"],
};
