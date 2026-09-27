import type { MetadataRoute } from "next";

import { FeedOrderBy, FeedType } from "@chia/db/types";
import { WWW_BASE_URL } from "@chia/utils/config";

import { getPathname } from "@/libs/i18n/navigation";
import { routing } from "@/libs/i18n/routing";
import { client } from "@/libs/orpc/client.rsc";
import { dbLocaleResolver } from "@/libs/utils/i18n";
import routes from "@/shared/routes";

export const dynamic = "force-dynamic";

/** One entry per locale, each naming every locale as an alternate. */
const localizedEntries = (
  href: string,
  locales: readonly Locale[],
  lastModified?: string
): MetadataRoute.Sitemap => {
  const urls = locales.map(
    (locale) =>
      [locale, `${WWW_BASE_URL}${getPathname({ href, locale })}`] as const
  );
  const languages = Object.fromEntries(urls);
  return urls.map(([, url]) => ({
    url,
    lastModified,
    alternates: { languages },
  }));
};

/** `undefined` when there is nothing to date the page by, which is better than a made-up date. */
const newest = (dates: readonly (string | Date)[]) => {
  if (dates.length === 0) return undefined;
  return new Date(
    Math.max(...dates.map((date) => new Date(date).getTime()))
  ).toISOString();
};

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [feedLists, { items: tags }] = await Promise.all([
    Promise.all(
      routing.locales.map(async (locale) => {
        const { items } = await client.feeds.list({
          limit: 1000,
          type: FeedType.All,
          orderBy: FeedOrderBy.UpdatedAt,
          sortOrder: "desc",
          withContent: false,
          locale: dbLocaleResolver(locale),
          translated: true,
        });
        return items.map((feed) => ({ feed, locale }));
      })
    ),
    client.tags.list(),
  ]);
  const listed = feedLists.flat();

  const feeds = new Map<
    string,
    { href: string; updatedAt: string; locales: Locale[] }
  >();
  for (const { feed, locale } of listed) {
    const entry = feeds.get(feed.slug) ?? {
      href: `/${feed.type}s/${feed.slug}`,
      updatedAt: feed.updatedAt,
      locales: [],
    };
    entry.locales.push(locale);
    feeds.set(feed.slug, entry);
  }

  const updatedWhere = (matches: (href: string) => boolean) =>
    newest(
      [...feeds.values()]
        .filter((feed) => matches(feed.href))
        .map((feed) => feed.updatedAt)
    );
  const liveTags = tags.filter((tag) => tag.feedCount > 0);

  return [
    ...localizedEntries(
      "/",
      routing.locales,
      updatedWhere(() => true)
    ),
    ...Object.keys(routes).flatMap((path) =>
      localizedEntries(
        path,
        routing.locales,
        updatedWhere((href) => href.startsWith(`${path}/`))
      )
    ),
    ...[...feeds.values()].flatMap((feed) =>
      localizedEntries(feed.href, feed.locales, feed.updatedAt)
    ),
    ...localizedEntries(
      "/tags",
      routing.locales,
      newest([
        ...liveTags.map((tag) => tag.updatedAt),
        ...listed.map(({ feed }) => feed.updatedAt),
      ])
    ),
    ...liveTags.flatMap((tag) =>
      localizedEntries(
        `/tags/${tag.slug}`,
        routing.locales,
        newest([
          tag.updatedAt,
          ...listed
            .filter(({ feed }) => feed.tags.some((t) => t.slug === tag.slug))
            .map(({ feed }) => feed.updatedAt),
        ])
      )
    ),
  ];
}
