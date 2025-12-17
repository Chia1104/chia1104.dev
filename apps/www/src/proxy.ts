import createMiddleware from "next-intl/middleware";

import { routing } from "./libs/i18n/routing";

export default createMiddleware(routing);

export const config = {
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};
