import type { MetadataRoute } from "next";

import {
  FeedMode,
  FeedOrderBy,
  FeedType,
  MediaKind,
  feedModeOf,
} from "@chia/db/types";
import { feedPath, WWW_BASE_URL } from "@chia/utils/config";

import { getPathname } from "@/libs/i18n/navigation";
import { routing } from "@/libs/i18n/routing";
import { client } from "@/libs/orpc/client.rsc";
import { dbLocaleResolver } from "@/libs/utils/i18n";
import { HOBBY_FEED_SEGMENT } from "@/shared/hobby-feed";
import { MEDIA_KIND_SEGMENT, mediaHrefOf } from "@/shared/media";
import routes from "@/shared/routes";
import { SITE_MODE_HOME, SiteMode } from "@/shared/site-mode";

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

const HOBBY_HOME = SITE_MODE_HOME[SiteMode.Hobby];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [feedLists, { items: tags }, { items: media }] = await Promise.all([
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
    client.tags.list({ mode: FeedMode.Tech }),
    client.media.list({}),
  ]);
  const listed = feedLists.flat();

  const feeds = new Map<
    string,
    { href: string; updatedAt: string; locales: Locale[] }
  >();
  for (const { feed, locale } of listed) {
    const entry = feeds.get(feed.slug) ?? {
      href: feedPath(feed),
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
      updatedWhere((href) => !href.startsWith(`${HOBBY_HOME}/`))
    ),
    ...Object.keys(routes[SiteMode.Tech]).flatMap((path) =>
      localizedEntries(
        path,
        routing.locales,
        updatedWhere((href) => href.startsWith(`${path}/`))
      )
    ),
    ...localizedEntries(
      HOBBY_HOME,
      routing.locales,
      newest(media.map((entry) => entry.updatedAt))
    ),
    ...Object.values(MediaKind).flatMap((kind) =>
      localizedEntries(
        `${HOBBY_HOME}/${MEDIA_KIND_SEGMENT[kind]}`,
        routing.locales,
        newest(
          media
            .filter((entry) => entry.kind === kind)
            .map((entry) => entry.updatedAt)
        )
      )
    ),
    ...Object.values(HOBBY_FEED_SEGMENT).flatMap((segment) =>
      localizedEntries(
        `${HOBBY_HOME}/${segment}`,
        routing.locales,
        updatedWhere((href) => href.startsWith(`${HOBBY_HOME}/${segment}/`))
      )
    ),
    ...media.flatMap((entry) =>
      localizedEntries(
        mediaHrefOf(entry),
        routing.locales,
        entry.updatedAt.toISOString()
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
            .filter(
              ({ feed }) =>
                feedModeOf(feed.type) === FeedMode.Tech &&
                feed.tags.some((t) => t.slug === tag.slug)
            )
            .map(({ feed }) => feed.updatedAt),
        ])
      )
    ),
  ];
}
