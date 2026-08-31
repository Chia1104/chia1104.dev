import { defineRouting } from "next-intl/routing";

import { Locale } from "@/libs/utils/i18n";

export const routing = defineRouting({
  // A list of all locales that are supported
  locales: Object.values(Locale),

  // Used when no locale matches
  defaultLocale: Locale.ZH_TW,

  localePrefix: "as-needed",
});
