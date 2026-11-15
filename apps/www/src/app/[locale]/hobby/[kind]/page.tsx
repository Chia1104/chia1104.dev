import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ViewTransition } from "react";

import { getLocale, getTranslations } from "next-intl/server";

import { HobbyIndex } from "@/components/hobby/hobby-index";
import { localizedMetadata } from "@/libs/i18n/alternates";
import { MEDIA_KIND_SEGMENT, mediaKindOfSegment } from "@/shared/media";

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

  return (
    <ViewTransition>
      <HobbyIndex kind={kind} />
    </ViewTransition>
  );
};

export default Page;
