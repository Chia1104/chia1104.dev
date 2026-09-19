import { ViewTransition } from "react";

import { Skeleton } from "@heroui/react";
import { getTranslations } from "next-intl/server";

import { FeedType } from "@chia/db/types";
import { NoiseBackground } from "@chia/shaders/noise-background";
import DateFormat from "@chia/ui/date-format";

import { Link } from "@/libs/i18n/navigation";
import { client } from "@/libs/orpc/client.rsc";
import { dbLocaleResolver } from "@/libs/utils/i18n";

interface RelatedFeedsProps {
  locale: Locale;
  slug: string;
}

const SECTION_CLASS_NAME =
  "not-prose page-md:grid-cols-[11rem_minmax(0,1fr)] page-md:gap-x-10 mt-16 grid w-full gap-y-4";

const LIST_CLASS_NAME = "flex flex-col gap-5 pr-2.5 pb-2.5";

export function RelatedFeedsSkeleton() {
  return (
    <section
      aria-busy="true"
      aria-label="Loading related articles"
      className={SECTION_CLASS_NAME}>
      <div className="flex flex-col gap-2">
        <Skeleton className="h-6 w-28 rounded-md" />
        <Skeleton className="h-3 w-40 rounded-md" />
      </div>
      <ul className={LIST_CLASS_NAME}>
        {["related-feed-1", "related-feed-2", "related-feed-3"].map((item) => (
          <li
            key={item}
            className="bg-default/60 flex flex-col gap-2 rounded-3xl px-5 py-4">
            <Skeleton className="h-5 w-3/4 rounded-md" />
            <Skeleton className="h-3 w-full rounded-md" />
            <Skeleton className="h-3 w-24 rounded-md" />
          </li>
        ))}
      </ul>
    </section>
  );
}

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
    <section
      aria-labelledby="related-feeds-title"
      className={SECTION_CLASS_NAME}>
      <div className="page-md:pt-4 flex flex-col gap-1">
        <h2
          id="related-feeds-title"
          className="text-foreground text-lg font-semibold">
          {t("related-feeds")}
        </h2>
        <p className="text-muted text-sm leading-relaxed text-pretty">
          {t("related-feeds-description")}
        </p>
      </div>
      <ol className={LIST_CLASS_NAME}>
        {feeds.items.map((feed) => {
          const isNote = feed.type === FeedType.Note;
          const summary = feed.description ?? feed.excerpt;
          // Shared with the article `h1` so the title carries over on navigation.
          const transitionName = `view-transition-link-${feed.id}`;

          return (
            <li key={feed.id}>
              <Link
                href={`/${isNote ? "notes" : "posts"}/${feed.slug}`}
                className="group/card focus-visible:ring-focus relative isolate block rounded-3xl outline-none focus-visible:ring-2">
                <span
                  aria-hidden="true"
                  className="border-accent absolute inset-0 rounded-3xl border bg-[repeating-linear-gradient(-45deg,var(--color-accent)_0_1.5px,transparent_1.5px_6px)] opacity-0 transition-[translate,opacity] duration-300 ease-out group-hover/card:translate-1.5 group-hover/card:opacity-100 group-focus-visible/card:translate-1.5 group-focus-visible/card:opacity-100 motion-reduce:transition-opacity"
                />
                <NoiseBackground
                  gradientColors={{
                    light: ["#F9C851", "#FCA5A5"],
                    // Tailwind purple-400 and pink-400; the shader needs concrete colors.
                    dark: [
                      "oklch(71.4% 0.203 305.504)",
                      "oklch(71.8% 0.202 349.761)",
                    ],
                  }}
                  className="page-sm:grid-cols-[minmax(0,1fr)_auto] page-sm:gap-x-8 grid gap-y-1.5 px-5 py-4">
                  <ViewTransition name={transitionName}>
                    <span
                      className="text-foreground text-base leading-snug font-medium text-balance"
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
                </NoiseBackground>
              </Link>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
