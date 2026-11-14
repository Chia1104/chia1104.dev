import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ViewTransition } from "react";

import { getLocale, getTranslations } from "next-intl/server";

import { MediaStatus } from "@chia/db/types";

import {
  MediaSection,
  MediaSectionLayout,
} from "@/components/hobby/media-section";
import { localizedMetadata } from "@/libs/i18n/alternates";
import { client } from "@/libs/orpc/client.rsc";
import { MEDIA_KIND_SEGMENT, mediaKindOfSegment } from "@/shared/media";

/** The order a kind's log reads in: what is on now, then what is done, then the rest. */
const STATUS_ORDER = [
  MediaStatus.InProgress,
  MediaStatus.Completed,
  MediaStatus.Planned,
  MediaStatus.Dropped,
] as const;

export function generateStaticParams() {
  return Object.values(MEDIA_KIND_SEGMENT).map((kind) => ({ kind }));
}

/** Any other segment is a 404 served without rendering. */
export const dynamicParams = false;

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/hobby/[kind]">): Promise<Metadata> {
  const { kind: segment } = await params;
  const kind = mediaKindOfSegment(segment);
  if (!kind) return {};
  const [locale, t, tRoutes] = await Promise.all([
    getLocale(),
    getTranslations("hobby"),
    getTranslations("routes"),
  ]);
  return {
    title: tRoutes(MEDIA_KIND_SEGMENT[kind]),
    description: t(`kind-description.${kind}`),
    ...localizedMetadata({ href: `/hobby/${segment}`, locale }),
  };
}

const Page = async ({ params }: PageProps<"/[locale]/hobby/[kind]">) => {
  const { kind: segment } = await params;
  const kind = mediaKindOfSegment(segment);
  if (!kind) notFound();

  const [t, { items }] = await Promise.all([
    getTranslations("hobby"),
    client.media.list({ kind }),
  ]);

  return (
    <ViewTransition>
      <article className="flex w-full flex-col gap-12">
        <p className="text-muted max-w-prose text-lg leading-relaxed text-pretty">
          {t(`kind-description.${kind}`)}
        </p>
        {items.length === 0 ? <p className="text-muted">{t("empty")}</p> : null}
        {STATUS_ORDER.map((status) => (
          <MediaSection
            key={status}
            title={t(`status.${status}`)}
            items={items.filter((entry) => entry.status === status)}
            layout={MediaSectionLayout.Wall}
          />
        ))}
      </article>
    </ViewTransition>
  );
};

export default Page;
