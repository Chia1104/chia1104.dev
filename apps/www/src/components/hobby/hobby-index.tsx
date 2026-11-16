import type { ReactNode } from "react";

import { getLocale, getTranslations } from "next-intl/server";

import { FeedType, MediaKind } from "@chia/db/types";

import { MediaList } from "@/components/hobby/media-list";
import { Link } from "@/libs/i18n/navigation";
import { hobbyFeedsOf } from "@/libs/media.rsc";
import { client } from "@/libs/orpc/client.rsc";
import { dbLocaleResolver } from "@/libs/utils/i18n";
import {
  HOBBY_FEED_SEGMENT,
  hobbyFeedHrefOf,
  isHobbyFeedType,
} from "@/shared/hobby-feed";
import type { HobbyFeedType } from "@/shared/hobby-feed";
import { MEDIA_KIND_SEGMENT, mediaHrefOf, mediaTitleOf } from "@/shared/media";
import type { MediaRow } from "@/shared/media";
import { SITE_MODE_HOME, SiteMode } from "@/shared/site-mode";

const HOME = SITE_MODE_HOME[SiteMode.Hobby];

/**
 * The hobby log, whole or narrowed to one kind of work or one kind of writing: a sentence whose
 * nouns are the filters, then every match as a line. Lines are not grouped; works come newest
 * activity first, articles newest first.
 */
export const HobbyIndex = async ({
  kind,
  article,
}: {
  kind?: MediaKind;
  /** Lists the articles of this type instead of works. */
  article?: HobbyFeedType;
}) => {
  const [locale, t, { items }, feeds] = await Promise.all([
    getLocale(),
    getTranslations("hobby"),
    // An article row borrows the colour and key art of the work it is about.
    client.media.list(kind ? { kind } : {}),
    article ? hobbyFeedsOf({ type: article }) : null,
  ]);
  const dbLocale = dbLocaleResolver(locale);

  const works = new Map(items.map((entry) => [entry.id, entry]));
  const rows = feeds
    ? feeds.flatMap((feed): MediaRow[] => {
        if (!isHobbyFeedType(feed.type)) return [];
        const work =
          feed.mediaEntryId === null ? undefined : works.get(feed.mediaEntryId);
        return [
          {
            id: feed.id,
            title: feed.translations[0]?.title ?? feed.slug,
            kind: t(`article.${feed.type}`),
            subject: work ? mediaTitleOf(work, dbLocale) : null,
            year: new Date(feed.createdAt).getFullYear(),
            href: hobbyFeedHrefOf({ type: feed.type, slug: feed.slug }),
            sheet: false,
            color: work?.color ?? null,
            backdropUrl: work ? (work.backdropUrl ?? work.posterUrl) : null,
          },
        ];
      })
    : items.map((entry): MediaRow => ({
        id: entry.id,
        title: mediaTitleOf(entry, dbLocale),
        kind: t(`kind.${entry.kind}`),
        subject: null,
        year: entry.releaseYear,
        href: mediaHrefOf(entry),
        sheet: true,
        color: entry.color,
        // A cover is portrait, but the field crops it to fill; better than leaving the stage on noise.
        backdropUrl: entry.backdropUrl ?? entry.posterUrl,
      }));

  /** A noun in the sentence: it narrows the list to its target, and widens it again when current. */
  const filter = (segment: string, current: boolean) => (chunks: ReactNode) => (
    <Link
      href={current ? HOME : `${HOME}/${segment}`}
      aria-current={current ? "page" : undefined}
      className="text-foreground decoration-muted/50 hover:decoration-accent aria-[current]:decoration-accent focus-visible:ring-focus rounded-sm underline decoration-2 underline-offset-[0.2em] transition-colors outline-none focus-visible:ring-2">
      {chunks}
    </Link>
  );
  const work = (target: MediaKind) =>
    filter(MEDIA_KIND_SEGMENT[target], target === kind);
  const writing = (target: HobbyFeedType) =>
    filter(HOBBY_FEED_SEGMENT[target], target === article);

  return (
    <article className="flex w-full flex-1 flex-col gap-[clamp(2rem,6vw,5rem)]">
      <p className="text-muted max-w-[34ch] px-(--hobby-gutter) text-[clamp(1.25rem,2.4vw,2rem)] leading-snug font-medium text-pretty">
        {t.rich("intro", {
          movies: work(MediaKind.Movie),
          series: work(MediaKind.Series),
          anime: work(MediaKind.Anime),
          games: work(MediaKind.Game),
        })}{" "}
        {t.rich("articles-intro", {
          guides: writing(FeedType.Guide),
          reviews: writing(FeedType.Review),
          journal: writing(FeedType.Journal),
        })}
      </p>
      {rows.length === 0 ? (
        <p className="text-muted px-(--hobby-gutter)">{t("empty")}</p>
      ) : (
        <MediaList rows={rows} />
      )}
    </article>
  );
};
