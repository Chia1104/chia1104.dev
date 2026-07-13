import { Card, Skeleton } from "@heroui/react";
import { getTranslations } from "next-intl/server";

import { Link } from "@/libs/i18n/routing";
import { createFeedImageToken } from "@/libs/utils/feed-image-token";
import type { getRelatedFeeds } from "@/services/feeds.service";

import { RelatedFeedsImageBackground } from "./related-feeds-image-background";

type RelatedFeed = Awaited<ReturnType<typeof getRelatedFeeds>>["items"][number];

interface RelatedFeedsProps {
  items: RelatedFeed[];
  locale: Locale;
}

export function RelatedFeedsSkeleton() {
  return (
    <section
      aria-busy="true"
      aria-label="Loading related articles"
      className="not-prose mt-12 w-full">
      <Skeleton className="mb-4 h-7 w-40 rounded-lg" />
      <ul className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {["related-feed-1", "related-feed-2", "related-feed-3"].map((item) => (
          <li key={item}>
            <Card
              variant="transparent"
              className="relative isolate aspect-40/21 overflow-hidden rounded-xl p-0">
              <Skeleton className="absolute inset-0 rounded-none" />
              <Card.Header className="relative z-10 mt-auto w-full gap-2 p-4">
                <Skeleton className="h-5 w-3/4 rounded-md" />
                <Skeleton className="h-3 w-full rounded-md" />
                <Skeleton className="h-3 w-2/3 rounded-md" />
              </Card.Header>
            </Card>
          </li>
        ))}
      </ul>
    </section>
  );
}

export async function RelatedFeeds({ items, locale }: RelatedFeedsProps) {
  if (items.length === 0) {
    return null;
  }

  const t = await getTranslations("blog");

  return (
    <section
      aria-labelledby="related-feeds-title"
      className="not-prose mt-12 w-full">
      <h2 id="related-feeds-title" className="mb-4 text-xl font-semibold">
        {t("related-feeds")}
      </h2>
      <ul className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {items.map((feed) => {
          const type = `${feed.type}s`;
          const token = createFeedImageToken({
            locale,
            slug: feed.slug,
            type,
          });

          return (
            <li key={feed.id}>
              <Link
                href={`/${type}/${feed.slug}`}
                className="focus-visible:ring-focus group block h-full rounded-xl outline-none focus-visible:ring-2">
                <Card
                  variant="transparent"
                  className="border-default relative isolate aspect-40/21 h-full overflow-hidden rounded-xl border p-0">
                  <RelatedFeedsImageBackground
                    locale={locale}
                    type={type}
                    slug={feed.slug}
                    token={token}
                  />
                  {/* <div
                    aria-hidden="true"
                    className="absolute inset-0 z-1 bg-linear-to-t from-white/90 via-white/35 to-transparent transition-colors duration-300  dark:from-black/90 dark:via-black/35"
                  />
                  <Card.Header className="relative z-2 mt-auto w-full gap-1 p-4 ">
                    <Card.Title className="text-foreground-900 dark:text-foreground-50 line-clamp-2 text-base drop-shadow-sm">
                      {feed.title}
                    </Card.Title>
                    {(feed.description ?? feed.excerpt) ? (
                      <Card.Description className="text-foreground-700 dark:text-foreground-300 line-clamp-2 text-sm">
                        {feed.description ?? feed.excerpt}
                      </Card.Description>
                    ) : null}
                  </Card.Header> */}
                </Card>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
