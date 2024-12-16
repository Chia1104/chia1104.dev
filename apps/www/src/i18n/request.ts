import { getRequestConfig } from "next-intl/server";

// import { headers } from "next/headers";

import { I18N, DEFAULT_LOCALE } from "@/utils/i18n";

export default getRequestConfig(async ({ requestLocale }) => {
  // This typically corresponds to the `[locale]` segment
  let locale = await requestLocale;

  // const headersList = await headers();
  // let timeZone = headersList.get("x-vercel-ip-timezone");
  let timeZone = "Asia/Taipei";

  // Ensure that a valid locale is used
  if (!locale || !Object.values(I18N).includes(locale)) {
    locale = DEFAULT_LOCALE;
  }

  if (!timeZone) {
    timeZone = "Asia/Taipei";
  }

  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
    timeZone,
  };
});
