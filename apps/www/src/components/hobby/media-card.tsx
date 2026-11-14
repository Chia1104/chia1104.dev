import { getLocale, getTranslations } from "next-intl/server";

import Image from "@chia/ui/image";

import { dbLocaleResolver } from "@/libs/utils/i18n";
import {
  MEDIA_SOURCE_NAME,
  mediaTitleOf,
  mediaTranslationOf,
} from "@/shared/media";
import type { MediaEntry } from "@/shared/media";

/** Covers are stored about 780px wide; a tile never shows more than a third of the page. */
const COVER_SIZES = "(min-width: 992px) 220px, (min-width: 640px) 30vw, 45vw";

/**
 * One logged work: its cover, title, year and rating, and the comment when `detailed`. The cover
 * links to the work's page in the catalogue it was added from.
 */
export const MediaCard = async ({
  entry,
  detailed = false,
}: {
  entry: MediaEntry;
  detailed?: boolean;
}) => {
  const [locale, t] = await Promise.all([
    getLocale(),
    getTranslations("hobby"),
  ]);
  const dbLocale = dbLocaleResolver(locale);
  const title = mediaTitleOf(entry, dbLocale);
  const comment = mediaTranslationOf(entry, dbLocale)?.comment;

  const cover = (
    <div className="bg-default relative aspect-2/3 overflow-hidden rounded-lg">
      {entry.posterUrl ? (
        <Image
          src={entry.posterUrl}
          alt=""
          fill
          sizes={COVER_SIZES}
          className="object-cover"
        />
      ) : (
        <span
          aria-hidden
          className="text-muted absolute inset-0 flex items-center p-3 text-sm leading-snug font-semibold text-balance">
          {title}
        </span>
      )}
    </div>
  );

  return (
    <article className="relative flex flex-col gap-2">
      {entry.sourceUrl ? (
        <a
          href={entry.sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={t("source", {
            title,
            source: MEDIA_SOURCE_NAME[entry.source],
          })}
          className="focus-visible:ring-focus rounded-lg transition-opacity outline-none hover:opacity-85 focus-visible:ring-2 focus-visible:ring-offset-2">
          {cover}
        </a>
      ) : (
        cover
      )}
      {entry.favorite ? (
        <span
          role="img"
          aria-label={t("favorite")}
          className="bg-accent text-accent-foreground absolute -top-2 -right-2 flex size-8 rotate-12 items-center justify-center rounded-full shadow-sm">
          <span aria-hidden className="i-mdi-star size-4" />
        </span>
      ) : null}
      <div className="flex flex-col gap-0.5">
        <h3 className="line-clamp-2 text-sm leading-snug font-semibold text-pretty">
          {title}
        </h3>
        <p className="text-muted flex justify-between gap-2 text-xs tabular-nums">
          <span>{entry.releaseYear}</span>
          {entry.rating === null ? null : (
            <span>{t("rating", { rating: entry.rating })}</span>
          )}
        </p>
      </div>
      {detailed && comment ? (
        <p className="text-muted line-clamp-4 text-sm leading-relaxed text-pretty">
          {comment}
        </p>
      ) : null}
    </article>
  );
};
