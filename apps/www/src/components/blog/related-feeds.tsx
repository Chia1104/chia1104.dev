import { getTranslations } from "next-intl/server";

import { Link } from "@/libs/i18n/routing";
import type { getRelatedFeeds } from "@/services/feeds.service";

type RelatedFeed = Awaited<ReturnType<typeof getRelatedFeeds>>["items"][number];

interface RelatedFeedsProps {
  items: RelatedFeed[];
}

export async function RelatedFeeds({ items }: RelatedFeedsProps) {
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
        {items.map((feed) => (
          <li key={feed.id}>
            <Link
              href={`/${feed.type}s/${feed.slug}`}
              className="border-default hover:bg-default/50 focus-visible:ring-focus block h-full rounded-xl border p-4 transition-colors outline-none focus-visible:ring-2">
              <h3 className="line-clamp-2 font-medium">{feed.title}</h3>
              <p className="text-foreground-600 mt-2 line-clamp-3 text-sm">
                {feed.description ?? feed.excerpt}
              </p>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
