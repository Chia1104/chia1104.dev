import { getRequestConfig } from "next-intl/server";
import { headers } from "next/headers";

import { env } from "@/env";

import { routing } from "./routing";

export default getRequestConfig(async ({ requestLocale }) => {
  // This typically corresponds to the `[locale]` segment
  let locale = await requestLocale;

  const headersList = await headers();
  let timeZone = headersList.get("x-vercel-ip-timezone");

  console.log("Client TimeZone: ", timeZone);

  // Ensure that a valid locale is used
  if (!locale || !routing.locales.includes(locale)) {
    locale = routing.defaultLocale;
  }

  if (!timeZone) {
    timeZone = env.NEXT_PUBLIC_DEFAULT_TIME_ZONE;
  }

  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
    timeZone,
  };
});
