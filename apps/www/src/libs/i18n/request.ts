import { notFound } from "next/navigation";
import * as rootParams from "next/root-params";

import { hasLocale } from "next-intl";
import { getRequestConfig } from "next-intl/server";

import { env } from "@/env";

import { routing } from "./routing";

export default getRequestConfig(async ({ locale: localeOverride }) => {
  let locale = localeOverride;

  if (!locale) {
    const paramValue = await rootParams.locale();

    if (!hasLocale(routing.locales, paramValue)) {
      notFound();
    }

    locale = paramValue;
  }

  return {
    locale,
    messages: (await import(`@chia/i18n/www/${locale}.json`)).default,
    timeZone: env.NEXT_PUBLIC_DEFAULT_TIME_ZONE,
    formats: {
      dateTime: {
        short: {
          day: "numeric",
          month: "short",
          year: "numeric",
        },
      },
      number: {
        precise: {
          maximumFractionDigits: 5,
        },
      },
      list: {
        enumeration: {
          style: "long",
          type: "conjunction",
        },
      },
    },
  };
});
