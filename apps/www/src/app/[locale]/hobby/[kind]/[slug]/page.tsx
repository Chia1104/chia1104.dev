import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ViewTransition } from "react";

import { getLocale, getTranslations } from "next-intl/server";

import { HobbyArticle } from "@/components/hobby/hobby-article";
import { MediaDetail, MediaSurface } from "@/components/hobby/media-detail";
import { localizedMetadata } from "@/libs/i18n/alternates";
import { Link } from "@/libs/i18n/navigation";
import { routing } from "@/libs/i18n/routing";
import { hobbyFeedOf, hobbyFeedsOf, mediaWorkOf } from "@/libs/media.rsc";
import { dbLocaleResolver } from "@/libs/utils/i18n";
import { hobbyFeedHrefOf, hobbyFeedTypeOfSegment } from "@/shared/hobby-feed";
import { mediaHrefOf, mediaTitleOf } from "@/shared/media";

// The first segment names a kind of work or a kind of writing; the slug is then a work's or an
// article's. A work reached from inside the site is intercepted into a sheet; an article is not.

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/hobby/[kind]/[slug]">): Promise<Metadata> {
  const [{ kind, slug }, locale] = await Promise.all([params, getLocale()]);

  if (hobbyFeedTypeOfSegment(kind)) {
    const reads = await Promise.all(
      routing.locales.map(async (candidate) => ({
        locale: candidate,
        article: await hobbyFeedOf(kind, slug, candidate),
      }))
    );
    const article = reads.find((read) => read.locale === locale)?.article;
    if (!article) return {};
    const metadata = localizedMetadata({
      href: hobbyFeedHrefOf({ type: article.type, slug }),
      locale,
      locales: reads.filter((read) => read.article).map((read) => read.locale),
    });
    return {
      title: article.translation.title,
      description: article.translation.description,
      ...metadata,
      openGraph: {
        ...metadata.openGraph,
        type: "article",
        publishedTime: article.feed.createdAt,
        modifiedTime: article.feed.updatedAt,
      },
    };
  }

  const work = await mediaWorkOf(kind, slug);
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
  const [{ kind, slug }, locale] = await Promise.all([params, getLocale()]);

  if (hobbyFeedTypeOfSegment(kind)) {
    const article = await hobbyFeedOf(kind, slug, locale);
    if (!article) notFound();
    return (
      <ViewTransition>
        <HobbyArticle article={article} />
      </ViewTransition>
    );
  }

  const [work, articles, t] = await Promise.all([
    mediaWorkOf(kind, slug),
    hobbyFeedsOf({ media: slug }),
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
        articles={articles}
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
