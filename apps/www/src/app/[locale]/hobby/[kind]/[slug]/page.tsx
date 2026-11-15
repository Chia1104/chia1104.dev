import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ViewTransition } from "react";

import { getLocale, getTranslations } from "next-intl/server";

import { MediaDetail, MediaSurface } from "@/components/hobby/media-detail";
import { localizedMetadata } from "@/libs/i18n/alternates";
import { Link } from "@/libs/i18n/navigation";
import { mediaWorkOf } from "@/libs/media.rsc";
import { dbLocaleResolver } from "@/libs/utils/i18n";
import { mediaHrefOf, mediaTitleOf } from "@/shared/media";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/hobby/[kind]/[slug]">): Promise<Metadata> {
  const { kind, slug } = await params;
  const [locale, work] = await Promise.all([
    getLocale(),
    mediaWorkOf(kind, slug),
  ]);
  if (!work) return {};
  const { entry } = work;
  const dbLocale = dbLocaleResolver(locale);
  const image = entry.backdropUrl ?? entry.posterUrl;
  const metadata = localizedMetadata({ href: mediaHrefOf(entry), locale });
  return {
    title: mediaTitleOf(entry, dbLocale),
    description: entry.translations[dbLocale]?.comment,
    ...metadata,
    openGraph: image
      ? { ...metadata.openGraph, images: [image] }
      : metadata.openGraph,
  };
}

const Page = async ({ params }: PageProps<"/[locale]/hobby/[kind]/[slug]">) => {
  const { kind, slug } = await params;
  const [work, t] = await Promise.all([
    mediaWorkOf(kind, slug),
    getTranslations("hobby"),
  ]);
  if (!work) notFound();

  return (
    <ViewTransition>
      <Link href="/hobby" className="link w-fit px-(--hobby-gutter) text-sm">
        {t("detail.back")}
      </Link>
      <MediaDetail
        entry={work.entry}
        achievements={work.achievements}
        surface={MediaSurface.Page}
        title={(text) => (
          <h1 className="text-[clamp(2rem,5vw,4.5rem)] leading-[1.05] font-bold tracking-tight text-balance">
            {text}
          </h1>
        )}
      />
    </ViewTransition>
  );
};

export default Page;
