import createMiddleware from "next-intl/middleware";

import { routing } from "./i18n/routing";

export default createMiddleware(routing);

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|_vercel|assets|robots.txt|favicon.ico|sitemap.xml|sitemap-0.xml).*)",
  ],
};
