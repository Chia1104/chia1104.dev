import { defineRouting } from "next-intl/routing";

import { Locale } from "@/libs/utils/i18n";

export const routing = defineRouting({
  locales: Object.values(Locale),

  defaultLocale: Locale.ZH_TW,

  localePrefix: "as-needed",
});
