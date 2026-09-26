import createMiddleware from "next-intl/middleware";

import { routing } from "./libs/i18n/routing";

export default createMiddleware(routing);

export const config = {
  /** Metadata image URLs already carry their locale; the locale redirect and cookie would keep crawlers and caches off them. */
  matcher: [
    "/((?!api|_next|_vercel|.*opengraph-image|.*\\..*).*)",
    "/(.*)/llm\\.md",
  ],
};
