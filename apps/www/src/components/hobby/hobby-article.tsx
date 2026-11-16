import type { ReactNode } from "react";

import { getFormatter, getLocale, getTranslations } from "next-intl/server";

import { Content } from "@chia/contents/content.rsc";
import { getContentProps } from "@chia/contents/services";
import { FeedType } from "@chia/db/types";
import { cn } from "@chia/ui/utils/cn.util";

import { MediaCover } from "@/components/hobby/media-cover";
import { StageWindow } from "@/components/hobby/stage-window";
import { StarRating } from "@/components/hobby/star-rating";
import { Link } from "@/libs/i18n/navigation";
import { hobbyFeedsOf } from "@/libs/media.rsc";
import type { HobbyArticle as Article } from "@/libs/media.rsc";
import { client } from "@/libs/orpc/client.rsc";
import { dbLocaleResolver } from "@/libs/utils/i18n";
import {
  HOBBY_FEED_SEGMENT,
  hobbyFeedHrefOf,
  isHobbyFeedType,
} from "@/shared/hobby-feed";
import { mediaHrefOf, mediaTitleOf, playtimeHoursOf } from "@/shared/media";
import { SITE_MODE_HOME, SiteMode } from "@/shared/site-mode";

const Spec = ({ label, children }: { label: string; children: ReactNode }) => (
  <div className="border-separator flex items-center justify-between gap-4 border-b py-2.5">
    <dt className="text-muted text-sm">{label}</dt>
    <dd className="text-sm font-semibold tabular-nums">{children}</dd>
  </div>
);

/**
 * One piece of hobby writing. Its head is a window onto the stage, which draws the key art of the
 * work the piece is about; the body is a sheet of the page colour that scrolls up over it, with
 * what the owner logged about that work beside the prose. A piece about no work has neither.
 */
export const HobbyArticle = async ({
  article: { feed, type, translation, content },
}: {
  article: Article;
}) => {
  const [locale, t, tBlog, format, { items }] = await Promise.all([
    getLocale(),
    getTranslations("hobby"),
    getTranslations("blog"),
    getFormatter(),
    feed.mediaEntryId === null ? { items: [] } : client.media.list({}),
  ]);
  const dbLocale = dbLocaleResolver(locale);
  const work = items.find((entry) => entry.id === feed.mediaEntryId);
  const name = work ? mediaTitleOf(work, dbLocale) : null;
  const others = work
    ? (await hobbyFeedsOf({ media: work.slug })).filter(
        (other) => other.id !== feed.id
      )
    : [];
  const published = new Date(feed.createdAt);
  const total = work?.achievementsTotal ?? null;
  const unlocked = work?.achievementsUnlocked ?? null;
  // A review's verdict heads the page, so the rail does not repeat it.
  const verdict = type === FeedType.Review ? (work?.rating ?? null) : null;

  return (
    // The tech frame places the body's floating contents rail beside its column; here it stands at
    // the viewport's edge.
    <article className="flex w-full flex-1 flex-col [--article-lift:clamp(2.5rem,6vw,5rem)] [--floating-toc-right:0.75rem]">
      <StageWindow
        color={work?.color ?? null}
        backdropUrl={work ? (work.backdropUrl ?? work.posterUrl) : null}
        className={cn(
          "flex min-h-[calc(70svh-9rem)] flex-col justify-end gap-5 px-(--hobby-gutter) pb-10 [text-shadow:0_1px_16px_var(--background)]",
          work ? "md:pb-[calc(var(--article-lift)+2rem)]" : "md:pb-14"
        )}>
        {type === FeedType.Journal ? (
          <time
            dateTime={feed.createdAt}
            className="text-muted text-[clamp(1.25rem,2.4vw,2rem)] leading-snug font-medium">
            {format.dateTime(published, { dateStyle: "full" })}
          </time>
        ) : null}
        <p className="text-muted flex flex-wrap items-baseline gap-x-5 gap-y-1 font-medium tabular-nums">
          <Link
            href={`${SITE_MODE_HOME[SiteMode.Hobby]}/${HOBBY_FEED_SEGMENT[type]}`}
            className="link text-foreground">
            {t(`article.${type}`)}
          </Link>
          {type === FeedType.Journal ? null : (
            <time dateTime={feed.createdAt}>
              {format.dateTime(published, { dateStyle: "medium" })}
            </time>
          )}
          {translation.readTime ? (
            <span>
              {tBlog("read-with-minutes", { minutes: translation.readTime })}
            </span>
          ) : null}
        </p>
        <h1 className="max-w-[16em] text-[clamp(2.25rem,6.2vw,5.75rem)] leading-[1.04] font-bold tracking-tight text-balance">
          {translation.title}
        </h1>
        {translation.description ? (
          <p className="text-muted max-w-[46rem] text-[clamp(1.125rem,1.9vw,1.5rem)] leading-snug font-medium text-pretty">
            {translation.description}
          </p>
        ) : null}
        {verdict === null ? null : (
          <p className="flex items-center gap-4">
            <StarRating
              rating={verdict}
              label={t("detail.rating-value", { rating: verdict })}
              starClassName="size-[clamp(1.75rem,3.4vw,2.75rem)]"
            />
            <span
              aria-hidden
              className="text-muted text-lg font-medium tabular-nums">
              {t("detail.rating-value", { rating: verdict })}
            </span>
          </p>
        )}
      </StageWindow>

      {/* Wider on the right from `md`, where the floating contents rail stands. */}
      <div className="bg-surface flex-1 px-(--hobby-gutter) pb-16 md:pr-[max(var(--hobby-gutter),3.5rem)]">
        <div className="grid gap-x-[clamp(2rem,6vw,6rem)] md:grid-cols-[minmax(0,46rem)_15rem]">
          {work && name ? (
            // The cover rises out of the sheet through the head's bottom padding, which is
            // `--article-lift` deeper than its text.
            <aside className="grid grid-cols-[auto_minmax(0,1fr)] items-end gap-x-4 gap-y-4 pt-8 md:sticky md:top-8 md:order-2 md:-mt-(--article-lift) md:grid-cols-1 md:self-start md:pt-0">
              {work.posterUrl ? (
                // The title beside it is the same link, and that one has a name.
                <Link
                  href={mediaHrefOf(work)}
                  scroll={false}
                  tabIndex={-1}
                  aria-hidden
                  className="w-fit">
                  <MediaCover
                    src={work.posterUrl}
                    className="aspect-2/3 w-24 shadow-lg md:w-36"
                  />
                </Link>
              ) : null}
              <p className="flex min-w-0 flex-col gap-1">
                <Link
                  href={mediaHrefOf(work)}
                  scroll={false}
                  className="link w-fit text-lg leading-snug font-semibold">
                  {name}
                </Link>
                <span className="text-muted flex gap-3 text-sm tabular-nums">
                  <span>{t(`kind.${work.kind}`)}</span>
                  {work.releaseYear === null ? null : (
                    <span>{work.releaseYear}</span>
                  )}
                </span>
              </p>
              <dl className="border-separator col-span-full border-t">
                <Spec label={t("detail.status")}>
                  {t(`status.${work.status}`)}
                </Spec>
                {work.rating === null || verdict !== null ? null : (
                  <Spec label={t("detail.rating")}>
                    <StarRating
                      rating={work.rating}
                      label={t("detail.rating-value", { rating: work.rating })}
                      starClassName="size-4"
                    />
                  </Spec>
                )}
                {work.finishedOn ? (
                  <Spec label={t("detail.finished")}>
                    {/* A calendar day is stored without a zone; formatting it in UTC keeps it that day. */}
                    {format.dateTime(new Date(`${work.finishedOn}T00:00:00Z`), {
                      dateStyle: "medium",
                      timeZone: "UTC",
                    })}
                  </Spec>
                ) : null}
                {work.playtimeMinutes === null ? null : (
                  <Spec label={t("detail.playtime")}>
                    {t("detail.playtime-value", {
                      hours: playtimeHoursOf(work.playtimeMinutes),
                    })}
                  </Spec>
                )}
                {unlocked === null || total === null || total === 0 ? null : (
                  <Spec label={t("detail.achievements")}>
                    <span className="flex items-center gap-2.5">
                      <span
                        role="meter"
                        aria-label={t("detail.achievements")}
                        aria-valuemin={0}
                        aria-valuemax={total}
                        aria-valuenow={unlocked}
                        className="bg-default block h-1.5 w-12 overflow-hidden rounded-full">
                        <span
                          className="bg-accent block h-full"
                          style={{ width: `${(unlocked / total) * 100}%` }}
                        />
                      </span>
                      {t("detail.achievements-value", { unlocked, total })}
                    </span>
                  </Spec>
                )}
              </dl>
            </aside>
          ) : null}

          <div className="min-w-0 pt-[clamp(2rem,5vw,4rem)] md:order-1">
            <Content
              content={getContentProps({ content })}
              context={{
                updatedAt: feed.updatedAt,
                tocContents: {
                  label: tBlog("otp"),
                  updated: tBlog("last-updated"),
                },
                locale,
              }}
            />
            {name && others.length > 0 ? (
              <section className="mt-12 flex flex-col gap-3">
                <h2 className="text-muted text-sm font-medium">
                  {t("article.more", { title: name })}
                </h2>
                <ul className="flex flex-col gap-2">
                  {others.map((other) =>
                    isHobbyFeedType(other.type) ? (
                      <li
                        key={other.id}
                        className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
                        <Link
                          href={hobbyFeedHrefOf({
                            type: other.type,
                            slug: other.slug,
                          })}
                          className="link text-lg font-semibold">
                          {other.translations[0]?.title ?? other.slug}
                        </Link>
                        <span className="text-muted flex gap-3 text-sm tabular-nums">
                          <span>{t(`article.${other.type}`)}</span>
                          <time dateTime={other.createdAt}>
                            {format.dateTime(new Date(other.createdAt), {
                              dateStyle: "medium",
                            })}
                          </time>
                        </span>
                      </li>
                    ) : null
                  )}
                </ul>
              </section>
            ) : null}
          </div>
        </div>
      </div>
    </article>
  );
};
