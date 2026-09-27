import type { Metadata } from "next";

import meta from "@chia/meta";

import { getPathname } from "@/libs/i18n/navigation";
import { routing } from "@/libs/i18n/routing";

/** `og:locale` separates the region with an underscore. */
const ogLocale = (locale: Locale) => locale.replace("-", "_");

/**
 * Canonical URL, hreflang alternates and the Open Graph fields that name the page's URL and
 * locale. `locales` narrows the alternates to the translations that exist.
 */
export const localizedMetadata = ({
  href,
  locale,
  locales = routing.locales,
}: {
  href: string;
  locale: Locale;
  locales?: readonly Locale[];
}) => {
  const canonical = getPathname({ href, locale });
  const xDefault = locales.includes(routing.defaultLocale)
    ? routing.defaultLocale
    : locale;
  return {
    alternates: {
      canonical,
      languages: {
        ...Object.fromEntries(
          locales.map((l) => [l, getPathname({ href, locale: l })])
        ),
        "x-default": getPathname({ href, locale: xDefault }),
      },
      types: {
        "application/rss+xml": getPathname({ href: "/rss.xml", locale }),
      },
    },
    openGraph: {
      url: canonical,
      siteName: meta.name,
      locale: ogLocale(locale),
      alternateLocale: locales.filter((l) => l !== locale).map(ogLocale),
    },
  } satisfies Metadata;
};
