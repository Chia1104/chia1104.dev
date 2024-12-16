import { createNavigation } from "next-intl/navigation";
import { defineRouting } from "next-intl/routing";

import { I18N } from "@/utils/i18n";

export const routing = defineRouting({
  // A list of all locales that are supported
  locales: Object.values(I18N),

  // Used when no locale matches
  defaultLocale: I18N.EN,

  localePrefix: "never",
});

// Lightweight wrappers around Next.js' navigation APIs
// that will consider the routing configuration
export const { Link, redirect, usePathname, useRouter, getPathname } =
  createNavigation(routing);
