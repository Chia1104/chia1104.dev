import Image from "next/image";
import type { ReactNode } from "react";

import { getFormatter, getLocale, getTranslations } from "next-intl/server";

import { MediaKind } from "@chia/db/types";
import { ReflectiveCard } from "@chia/shaders/reflective-card";
import { cn } from "@chia/ui/utils/cn.util";

import { MediaPin } from "@/components/hobby/media-pin";
import { StarRating } from "@/components/hobby/star-rating";
import { dbLocaleResolver } from "@/libs/utils/i18n";
import { MEDIA_SOURCE_NAME, mediaTitleOf } from "@/shared/media";
import type { MediaEntry } from "@/shared/media";

const MINUTES_PER_HOUR = 60;

/** Where a work's detail is shown; it decides what the key art fills. */
export const MediaSurface = {
  /** The dialog over the list: the art fills the sheet and stays put while it scrolls. */
  Sheet: "sheet",
  /** The work's own page: the art fills the viewport, behind the frame's header and footer. */
  Page: "page",
} as const;

export type MediaSurface = (typeof MediaSurface)[keyof typeof MediaSurface];

const Fact = ({ label, children }: { label: string; children: ReactNode }) => (
  <div className="flex flex-col gap-1">
    <dt className="text-muted text-xs font-medium">{label}</dt>
    <dd className="text-lg font-semibold tabular-nums">{children}</dd>
  </div>
);

/**
 * Everything logged about one work: its key art, what it is, and what the owner made of it.
 * `title` is rendered by the caller, which knows whether it heads a page or a dialog. The dialog
 * is portalled out of the page container, so the layout follows the viewport, not `page-*`.
 */
export const MediaDetail = async ({
  entry,
  title,
  surface,
}: {
  entry: MediaEntry;
  title: (text: string) => ReactNode;
  surface: MediaSurface;
}) => {
  const [locale, t, format] = await Promise.all([
    getLocale(),
    getTranslations("hobby"),
    getFormatter(),
  ]);
  const dbLocale = dbLocaleResolver(locale);
  const name = mediaTitleOf(entry, dbLocale);
  const comment = (
    entry.translations[dbLocale] ??
    Object.values(entry.translations).find((translation) => translation)
  )?.comment;
  /** A calendar day is stored without a zone; formatting it in UTC keeps it that day everywhere. */
  const day = (date: string) =>
    format.dateTime(new Date(`${date}T00:00:00Z`), {
      dateStyle: "medium",
      timeZone: "UTC",
    });
  const unlocked = entry.achievementsUnlocked;
  const total = entry.achievementsTotal;

  // Images are plain `next/image` with no referrer: storage refuses requests that carry one from
  // another origin, which a local page is.
  // A cover stands in when there is no key art; it is portrait, so it only lends its colours.
  const art = entry.backdropUrl ?? entry.posterUrl;

  const isSheet = surface === MediaSurface.Sheet;

  return (
    <article
      className={cn(
        "flex flex-col",
        // `cqh` is the sheet's height: the dialog body is a size container. On the page it is
        // the viewport's, and the article must not isolate: its art has to paint behind the
        // frame's wordmark, which stands before it.
        isSheet ? "relative isolate min-h-[100cqh]" : "flex-1"
      )}>
      <MediaPin color={entry.color} coversStage={!isSheet && art !== null} />
      {art ? (
        <div
          aria-hidden
          className={cn(
            "-z-1 overflow-hidden",
            // In the sheet the art is the first thing in the flow, pinned to the top while the
            // sheet scrolls; the negative margin starts the content over it.
            isSheet
              ? "sticky top-0 -mb-[100cqh] h-[100cqh] shrink-0"
              : "fixed inset-0"
          )}>
          <Image
            src={art}
            alt=""
            fill
            priority
            sizes="100vw"
            referrerPolicy="no-referrer"
            className={cn(
              "object-cover",
              entry.backdropUrl ? undefined : "scale-125 blur-2xl"
            )}
          />
          {/* The page colour, never opaque, so the art shows through all of it. On the page it
              starts thicker, under the frame's wordmark. */}
          <div
            className={cn(
              "via-background/45 to-background/85 md:to-background/70 absolute inset-0 bg-linear-to-b",
              isSheet ? "from-background/10" : "from-background/50"
            )}
          />
          {/* Thickened only on the side the text stands on; bright art would wash it out otherwise. */}
          <div className="from-background/70 via-background/25 absolute inset-0 hidden bg-linear-to-r to-transparent md:block" />
        </div>
      ) : null}
      <div
        className={cn(
          "relative grid gap-x-[clamp(1.5rem,4vw,3.5rem)] gap-y-8 px-(--hobby-gutter,clamp(1rem,3vw,3rem)) md:grid-cols-[auto_minmax(0,1fr)]",
          // In the sheet the content sinks to the bottom, which leaves the top of the art clear.
          isSheet
            ? "mt-auto pt-[18cqh] pb-[clamp(3rem,8vw,6rem)]"
            : "pt-6 pb-10"
        )}>
        {entry.posterUrl ? (
          <ReflectiveCard
            radius={12}
            // Capped by the surface's height, so a short window still shows the whole cover.
            className="aspect-2/3 h-[min(13.5rem,40cqh)] shadow-lg md:h-[min(21rem,42cqh)]">
            <Image
              src={entry.posterUrl}
              alt=""
              fill
              sizes="(min-width: 768px) 224px, 144px"
              referrerPolicy="no-referrer"
              className="object-cover"
            />
          </ReflectiveCard>
        ) : null}
        <div className="flex min-w-0 flex-col gap-8 [text-shadow:0_1px_16px_var(--background)]">
          <header className="flex flex-col gap-2">
            {title(name)}
            {entry.originalTitle && entry.originalTitle !== name ? (
              <p className="text-muted text-lg">{entry.originalTitle}</p>
            ) : null}
          </header>

          {comment ? (
            <p className="max-w-prose text-xl leading-relaxed text-pretty">
              {comment}
            </p>
          ) : null}

          <dl className="flex flex-wrap gap-x-10 gap-y-5">
            <Fact label={t("detail.status")}>
              {t(`status.${entry.status}`)}
            </Fact>
            {entry.rating === null ? null : (
              <Fact label={t("detail.rating")}>
                <StarRating
                  rating={entry.rating}
                  label={t("detail.rating-value", { rating: entry.rating })}
                />
              </Fact>
            )}
            {entry.releaseYear === null ? null : (
              <Fact label={t("detail.released")}>{entry.releaseYear}</Fact>
            )}
            {entry.startedOn ? (
              <Fact label={t("detail.started")}>{day(entry.startedOn)}</Fact>
            ) : null}
            {entry.finishedOn ? (
              <Fact label={t("detail.finished")}>{day(entry.finishedOn)}</Fact>
            ) : null}
          </dl>

          {entry.kind === MediaKind.Game &&
          (entry.playtimeMinutes !== null || total !== null) ? (
            <dl className="flex flex-wrap gap-x-10 gap-y-5">
              {entry.playtimeMinutes === null ? null : (
                <Fact label={t("detail.playtime")}>
                  {t("detail.playtime-value", {
                    hours: Math.round(entry.playtimeMinutes / MINUTES_PER_HOUR),
                  })}
                </Fact>
              )}
              {unlocked === null || total === null || total === 0 ? null : (
                <Fact label={t("detail.achievements")}>
                  <span className="flex items-center gap-3">
                    {t("detail.achievements-value", { unlocked, total })}
                    <span
                      role="meter"
                      aria-label={t("detail.achievements")}
                      aria-valuemin={0}
                      aria-valuemax={total}
                      aria-valuenow={unlocked}
                      className="bg-default block h-1.5 w-32 overflow-hidden rounded-full">
                      <span
                        className="bg-accent block h-full"
                        style={{ width: `${(unlocked / total) * 100}%` }}
                      />
                    </span>
                  </span>
                </Fact>
              )}
              {entry.lastPlayedAt ? (
                <Fact label={t("detail.last-played")}>
                  {format.dateTime(entry.lastPlayedAt, { dateStyle: "medium" })}
                </Fact>
              ) : null}
            </dl>
          ) : null}

          <p className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
            {entry.favorite ? (
              <span className="text-accent flex items-center gap-1.5 font-medium">
                <span aria-hidden className="i-mdi-star size-4" />
                {t("detail.favorite")}
              </span>
            ) : null}
            {entry.sourceUrl ? (
              <a
                href={entry.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="link">
                {t("detail.source", {
                  source: MEDIA_SOURCE_NAME[entry.source],
                })}
              </a>
            ) : null}
          </p>
        </div>
      </div>
    </article>
  );
};
