import { ViewTransition } from "react";

import { Skeleton } from "@heroui/react";
import { getTranslations } from "next-intl/server";

import { FeedType } from "@chia/db/types";
import DateFormat from "@chia/ui/date-format";
import { cn } from "@chia/ui/utils/cn.util";

import {
  Band,
  CELL_LINK_CLASS_NAME,
  LinkHatch,
  Panel,
  PanelDescription,
  PanelHeader,
  PanelTitle,
} from "@/components/commons/ruled";
import { Link } from "@/libs/i18n/navigation";
import { client } from "@/libs/orpc/client.rsc";
import { dbLocaleResolver } from "@/libs/utils/i18n";

interface RelatedFeedsProps {
  locale: Locale;
  slug: string;
}

const ROW_CLASS_NAME =
  "page-sm:grid-cols-[minmax(0,1fr)_auto] page-sm:gap-x-8 grid gap-y-1 px-4 py-3";

export function RelatedFeedsSkeleton() {
  return (
    <>
      <Panel aria-busy="true" aria-label="Loading related articles">
        <PanelHeader>
          <Skeleton className="h-6 w-28 rounded-md" />
          <Skeleton className="h-3 w-40 rounded-md" />
        </PanelHeader>
        <ul className="divide-separator divide-y">
          {["related-feed-1", "related-feed-2", "related-feed-3"].map(
            (item) => (
              <li key={item} className={ROW_CLASS_NAME}>
                <Skeleton className="h-5 w-3/4 rounded-md" />
                <Skeleton className="h-3 w-full rounded-md" />
              </li>
            )
          )}
        </ul>
      </Panel>
      <Band />
    </>
  );
}

/** Renders its trailing band itself, so an article without related posts leaves no empty break. */
export async function RelatedFeeds({ locale, slug }: RelatedFeedsProps) {
  const t = await getTranslations("blog");

  const feeds = await client.feeds.related({
    slug,
    locale: dbLocaleResolver(locale),
    limit: 3,
  });

  if (feeds.items.length === 0) {
    return null;
  }

  return (
    <>
      <Panel aria-labelledby="related-feeds-title">
        <PanelHeader>
          <PanelTitle id="related-feeds-title">{t("related-feeds")}</PanelTitle>
          <PanelDescription>{t("related-feeds-description")}</PanelDescription>
        </PanelHeader>
        <ol className="divide-separator divide-y">
          {feeds.items.map((feed) => {
            const isNote = feed.type === FeedType.Note;
            const summary = feed.description ?? feed.excerpt;
            // Shared with the article `h1` so the title carries over on navigation.
            const transitionName = `view-transition-link-${feed.id}`;

            return (
              <li key={feed.id}>
                <Link
                  href={`/${isNote ? "notes" : "posts"}/${feed.slug}`}
                  className={cn(CELL_LINK_CLASS_NAME, ROW_CLASS_NAME)}>
                  <LinkHatch />
                  <ViewTransition name={transitionName}>
                    <span
                      className="text-base leading-snug font-medium text-balance"
                      style={{ viewTransitionName: transitionName }}>
                      {feed.title}
                    </span>
                  </ViewTransition>
                  {summary ? (
                    <p className="text-muted line-clamp-2 text-sm leading-relaxed">
                      {summary}
                    </p>
                  ) : null}
                  <span className="text-muted page-sm:col-start-2 page-sm:row-span-2 page-sm:row-start-1 page-sm:flex-col page-sm:items-end page-sm:gap-0.5 page-sm:pt-0.5 flex gap-x-3 text-xs tabular-nums">
                    <DateFormat
                      date={feed.createdAt}
                      format="MMM D, YYYY"
                      locale={locale}
                    />
                    <span>
                      {isNote ? t("notes.doc-title") : t("posts.doc-title")}
                    </span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ol>
      </Panel>
      <Band />
    </>
  );
}
