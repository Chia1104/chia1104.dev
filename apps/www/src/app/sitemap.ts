import type { MetadataRoute } from "next";

import { FeedOrderBy, FeedType, Locale } from "@chia/db/types";
import { getBaseUrl, WWW_BASE_URL } from "@chia/utils/config";
import dayjs from "@chia/utils/day";

import { client } from "@/libs/orpc/client.rsc";
import { Locale as ILocale } from "@/libs/utils/i18n";
import routes from "@/shared/routes";

export const dynamic = "force-dynamic";
export const dynamicParams = true;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = getBaseUrl({
    isServer: true,
    baseUrl: WWW_BASE_URL,
    useBaseUrl: true,
  });

  const staticSitemapData = Object.values(Locale).flatMap((locale) =>
    Object.entries(routes).map(
      ([path, { priority }]) =>
        ({
          url: `${baseUrl}/${localeResolver(locale)}${path}`,
          lastModified: new Date().toISOString(),
          priority: priority,
          changeFrequency: "monthly",
        }) satisfies MetadataRoute.Sitemap[0]
    )
  );

  const feedsSitemapData = (
    await Promise.all(
      Object.values(Locale).map(async (locale) => {
        const { items } = await client.feeds.list({
          limit: 1000,
          type: FeedType.All,
          orderBy: FeedOrderBy.UpdatedAt,
          sortOrder: "desc",
          withContent: false,
          locale,
        });

        return items.map(
          (feed) =>
            ({
              url: `${baseUrl}/${localeResolver(locale)}/${feed.type}s/${feed.slug}`,
              lastModified: dayjs(feed.updatedAt).toISOString(),
              priority: 0.8,
              changeFrequency: "weekly",
            }) satisfies MetadataRoute.Sitemap[0]
        );
      })
    )
  ).flat();

  return [
    {
      url: `${baseUrl}/${localeResolver(Locale.En)}`,
      lastModified: new Date().toISOString(),
      priority: 0.7,
      changeFrequency: "monthly",
    },
    {
      url: `${baseUrl}/${localeResolver(Locale.zhTW)}`,
      lastModified: new Date().toISOString(),
      priority: 0.7,
      changeFrequency: "monthly",
    },
    {
      url: `${baseUrl}/${localeResolver(Locale.En)}/notes`,
      lastModified: new Date().toISOString(),
      priority: 0.8,
      changeFrequency: "weekly",
    },
    {
      url: `${baseUrl}/${localeResolver(Locale.zhTW)}/notes`,
      lastModified: new Date().toISOString(),
      priority: 0.8,
      changeFrequency: "weekly",
    },
    ...staticSitemapData,
    ...feedsSitemapData,
  ];
}

function localeResolver(locale: Locale) {
  switch (locale) {
    case Locale.En:
      return ILocale.EN;
    case Locale.zhTW:
      return ILocale.ZH_TW;
    default:
      return ILocale.ZH_TW;
  }
}
