import { unstable_ViewTransition as ViewTransition } from "react";

import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import type { Blog, WithContext } from "schema-dts";

import { Content } from "@chia/contents/content.rsc";
import { getContentProps } from "@chia/contents/services";
import DateFormat from "@chia/ui/date-format";
import Image from "@chia/ui/image";
import dayjs from "@chia/utils/day";

import FeedTranslationWarning from "@/components/blog/feed-translation-warning";
import WrittenBy from "@/components/blog/written-by";
import { getNotes, getFeedBySlug } from "@/services/feeds.service";
import { Locale } from "@/utils/i18n";

export const dynamicParams = true;
export const revalidate = 60;
export const maxDuration = 60;

export const generateStaticParams = async () => {
  const notes = await getNotes(100);

  return notes.items.map((note) => ({
    slug: note.slug,
  }));
};

export const generateMetadata = async ({
  params,
}: {
  params: PageParamsWithLocale<{
    slug: string;
  }>;
}): Promise<Metadata> => {
  const { slug } = await params;
  try {
    const note = await getFeedBySlug(slug);
    if (!note) notFound();
    return {
      title: note.title,
      description: note.excerpt,
    };
  } catch (error) {
    console.error(error);
    notFound();
  }
};

const Page = async ({
  params,
}: {
  params: PageParamsWithLocale<{
    slug: string;
  }>;
}) => {
  const { slug, locale } = await params;
  const note = await getFeedBySlug(slug);
  const t = await getTranslations("blog");

  if (!note?.content) {
    notFound();
  }

  const jsonLd: WithContext<Blog> = {
    "@context": "https://schema.org",
    "@type": "Blog",
    headline: note.title,
    datePublished: dayjs(note.createdAt).format("MMMM D, YYYY"),
    dateModified: dayjs(note.updatedAt).format("MMMM D, YYYY"),
    name: note.title,
    description: note.excerpt ?? "",
    author: {
      "@type": "Person",
      name: "Chia1104",
    },
  };

  return (
    <>
      <div className="flex w-full flex-col items-center">
        {locale !== Locale.ZH_TW && <FeedTranslationWarning />}
        <header className="mb-14 w-full self-center mt-5">
          <h1
            style={{
              viewTransitionName: `view-transition-link-${note.id}`,
            }}>
            {note.title}
          </h1>
          <p>{note.description}</p>
          <span className="mt-5 flex items-center gap-2 not-prose">
            <Image
              src="https://avatars.githubusercontent.com/u/38397958?v=4"
              width={40}
              height={40}
              className="rounded-full"
              alt="Chia1104"
            />
            <ViewTransition>
              <DateFormat
                date={note.createdAt}
                format="MMMM D, YYYY"
                locale={locale}
              />
            </ViewTransition>
          </span>
        </header>
        <Content
          content={getContentProps({
            contentType: note.contentType,
            content: note.content,
          })}
          context={{
            updatedAt: note.updatedAt,
            type: note.contentType,
            tocContents: {
              label: t("otp"),
              updated: t("last-updated"),
            },
            locale,
          }}
        />
        <WrittenBy
          className="w-full flex justify-start mt-10 relative self-start"
          author="Chia1104"
        />
      </div>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
    </>
  );
};

export default Page;
