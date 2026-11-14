import type { Metadata } from "next";
import { ViewTransition } from "react";

import { getLocale, getTranslations } from "next-intl/server";

import { MediaStatus } from "@chia/db/types";

import {
  MediaSection,
  MediaSectionLayout,
} from "@/components/hobby/media-section";
import { localizedMetadata } from "@/libs/i18n/alternates";
import { client } from "@/libs/orpc/client.rsc";

const SHELF_LIMIT = 18;

export async function generateMetadata(): Promise<Metadata> {
  const [locale, t] = await Promise.all([
    getLocale(),
    getTranslations("hobby"),
  ]);
  return {
    title: t("title"),
    description: t("description"),
    ...localizedMetadata({ href: "/hobby", locale }),
  };
}

const Page = async () => {
  const [t, inProgress, recent, favorites] = await Promise.all([
    getTranslations("hobby"),
    client.media.list({ status: MediaStatus.InProgress, limit: SHELF_LIMIT }),
    client.media.list({ status: MediaStatus.Completed, limit: SHELF_LIMIT }),
    client.media.list({ favorite: true, limit: SHELF_LIMIT }),
  ]);
  const isEmpty =
    inProgress.items.length + recent.items.length + favorites.items.length ===
    0;

  return (
    <ViewTransition>
      <article className="flex w-full flex-col gap-10">
        <p className="text-muted max-w-prose text-lg leading-relaxed text-pretty">
          {t("description")}
        </p>
        {isEmpty ? <p className="text-muted">{t("empty")}</p> : null}
        <MediaSection
          title={t("sections.in-progress")}
          items={inProgress.items}
          layout={MediaSectionLayout.Row}
        />
        <MediaSection
          title={t("sections.recent")}
          items={recent.items}
          layout={MediaSectionLayout.Row}
        />
        <MediaSection
          title={t("sections.favorites")}
          items={favorites.items}
          layout={MediaSectionLayout.Row}
        />
      </article>
    </ViewTransition>
  );
};

export default Page;
