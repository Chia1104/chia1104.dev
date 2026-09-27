import { notFound } from "next/navigation";

import { getRssString } from "@astrojs/rss";
import { getTranslations } from "next-intl/server";

import { FeedOrderBy, FeedType } from "@chia/db/types";
import meta from "@chia/meta";
import { WWW_BASE_URL } from "@chia/utils/config";
import { isEnumValue } from "@chia/utils/is";

import { getPathname } from "@/libs/i18n/navigation";
import { routing } from "@/libs/i18n/routing";
import { client } from "@/libs/orpc/client.rsc";
import { Locale, dbLocaleResolver } from "@/libs/utils/i18n";

/** Prerendered and refreshed by the `listings` cache tag its feed read carries. */
export const dynamic = "force-static";

export const generateStaticParams = () =>
  routing.locales.map((locale) => ({ locale }));

export const GET = async (
  _request: Request,
  { params }: { params: Promise<{ locale: string }> }
) => {
  const { locale } = await params;
  if (!isEnumValue(Locale, locale)) notFound();
  const [t, { items }] = await Promise.all([
    getTranslations({ locale, namespace: "profile" }),
    client.feeds.list({
      limit: 20,
      type: FeedType.All,
      orderBy: FeedOrderBy.CreatedAt,
      sortOrder: "desc",
      withContent: false,
      locale: dbLocaleResolver(locale),
    }),
  ]);
  const [latest] = items;

  const xml = await getRssString({
    title: meta.name,
    description: t("bio"),
    site: `${WWW_BASE_URL}${getPathname({ href: "/", locale })}`,
    trailingSlash: false,
    xmlns: { atom: "http://www.w3.org/2005/Atom" },
    customData: [
      `<language>${locale}</language>`,
      `<atom:link href="${WWW_BASE_URL}${getPathname({ href: "/rss.xml", locale })}" rel="self" type="application/rss+xml"/>`,
      latest
        ? `<lastBuildDate>${new Date(latest.createdAt).toUTCString()}</lastBuildDate>`
        : "",
    ].join(""),
    // The list carries every feed; one without this locale's translation has no page in it.
    items: items.flatMap((feed) => {
      const [translation] = feed.translations;
      if (!translation) return [];
      return {
        title: translation.title,
        description: translation.description ?? undefined,
        link: getPathname({ href: `/${feed.type}s/${feed.slug}`, locale }),
        pubDate: new Date(feed.createdAt),
        categories: feed.tags.map((tag) => tag.name),
      };
    }),
  });

  return new Response(xml, {
    headers: { "Content-Type": "application/rss+xml; charset=utf-8" },
  });
};
