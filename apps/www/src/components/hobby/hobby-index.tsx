import type { ReactNode } from "react";

import { getLocale, getTranslations } from "next-intl/server";

import { MediaKind } from "@chia/db/types";

import { MediaList } from "@/components/hobby/media-list";
import { Link } from "@/libs/i18n/navigation";
import { client } from "@/libs/orpc/client.rsc";
import { dbLocaleResolver } from "@/libs/utils/i18n";
import {
  MEDIA_KIND_SEGMENT,
  MEDIA_SOURCE_NAME,
  mediaTitleOf,
} from "@/shared/media";
import type { MediaRow } from "@/shared/media";
import { SITE_MODE_HOME, SiteMode } from "@/shared/site-mode";

const HOME = SITE_MODE_HOME[SiteMode.Hobby];

/**
 * The hobby log, whole or narrowed to `kind`: one sentence whose nouns are the filters, then
 * every work as a line. Works are not grouped; the order is the log's own, newest activity first.
 */
export const HobbyIndex = async ({ kind }: { kind?: MediaKind }) => {
  const [locale, t, { items }] = await Promise.all([
    getLocale(),
    getTranslations("hobby"),
    client.media.list(kind ? { kind } : {}),
  ]);
  const dbLocale = dbLocaleResolver(locale);

  const rows = items.map((entry): MediaRow => {
    const title = mediaTitleOf(entry, dbLocale);
    return {
      id: entry.id,
      title,
      kind: t(`kind.${entry.kind}`),
      year: entry.releaseYear,
      href: entry.sourceUrl,
      hrefLabel: t("source", {
        title,
        source: MEDIA_SOURCE_NAME[entry.source],
      }),
      color: entry.color,
      // A cover is portrait, but the field crops it to fill; better than leaving the stage on noise.
      backdropUrl: entry.backdropUrl ?? entry.posterUrl,
    };
  });

  /** A noun in the sentence: it narrows the list to its kind, and widens it again when current. */
  const filter = (target: MediaKind) => (chunks: ReactNode) => (
    <Link
      href={target === kind ? HOME : `${HOME}/${MEDIA_KIND_SEGMENT[target]}`}
      aria-current={target === kind ? "page" : undefined}
      className="text-foreground decoration-muted/50 hover:decoration-accent aria-[current]:decoration-accent focus-visible:ring-focus rounded-sm underline decoration-2 underline-offset-[0.2em] transition-colors outline-none focus-visible:ring-2">
      {chunks}
    </Link>
  );

  return (
    <article className="flex w-full flex-1 flex-col gap-[clamp(2rem,6vw,5rem)]">
      <p className="text-muted max-w-[34ch] px-(--hobby-gutter) text-[clamp(1.25rem,2.4vw,2rem)] leading-snug font-medium text-pretty">
        {t.rich("intro", {
          movies: filter(MediaKind.Movie),
          series: filter(MediaKind.Series),
          anime: filter(MediaKind.Anime),
          games: filter(MediaKind.Game),
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
