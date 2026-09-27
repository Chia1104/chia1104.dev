import type { Metadata } from "next";

import { getTranslations } from "next-intl/server";

import meta from "@chia/meta";

import NotFoundPage from "@/components/commons/not-found-page";
import SiteShell from "@/components/commons/site-shell";
import { routing } from "@/libs/i18n/routing";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations({
    locale: routing.defaultLocale,
    namespace: "status",
  });
  return { title: `${t("notFound.title")} | ${meta.name}` };
}

/** Unmatched URLs carry no locale, so they render in the default one, the locale of unprefixed paths. */
const GlobalNotFound = () => (
  <SiteShell locale={routing.defaultLocale}>
    <NotFoundPage />
  </SiteShell>
);

export default GlobalNotFound;
