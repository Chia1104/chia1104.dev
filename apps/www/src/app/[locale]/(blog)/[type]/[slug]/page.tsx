import { Suspense, ViewTransition } from "react";

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
import AppLoading from "@/components/commons/app-loading";
import { Locale } from "@/libs/utils/i18n";
import { getFeedBySlug, getFeeds } from "@/services/feeds.service";

export const revalidate = 120;

export const generateStaticParams = async () => {
  const feeds = await getFeeds(100);

  return feeds.items.map((feed) => ({
    type: `${feed.type}s`,
    slug: feed.slug,
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
    const feed = await getFeedBySlug(slug);
    if (!feed) {
      notFound();
    }
    return {
      title: feed.translations[0]?.title,
      description: feed.translations[0]?.description,
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
    type: "posts" | "notes";
    slug: string;
  }>;
}) => {
  const { slug, locale } = await params;
  const feed = await getFeedBySlug(slug);
  const t = await getTranslations("blog");

  const [translation] = feed?.translations ?? [];

  if (!translation?.content || !feed) {
    notFound();
  }

  const jsonLd: WithContext<Blog> = {
    "@context": "https://schema.org",
    "@type": "Blog",
    headline: feed.translations[0]?.title,
    datePublished: dayjs(feed.createdAt).format("MMMM D, YYYY"),
    dateModified: dayjs(feed.updatedAt).format("MMMM D, YYYY"),
    name: feed.translations[0]?.title,
    description: feed.translations[0]?.description ?? "",
    author: {
      "@type": "Person",
      name: "Chia1104",
    },
  };

  return (
    <ViewTransition>
      <div className="flex w-full flex-col items-center">
        {locale !== Locale.ZH_TW && <FeedTranslationWarning />}
        <header className="mb-5 w-full self-center mt-5">
          <div>
            <ViewTransition name={`view-transition-link-${feed.id}`}>
              <h1
                className="inline-block"
                style={{
                  viewTransitionName: `view-transition-link-${feed.id}`,
                }}>
                {feed.translations[0]?.title}
              </h1>
            </ViewTransition>
          </div>
          <p>{feed.translations[0]?.description}</p>
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
                date={feed.createdAt}
                format="MMMM D, YYYY"
                locale={locale}
              />
            </ViewTransition>
          </span>
        </header>
        <Suspense fallback={<AppLoading />}>
          <Content
            content={getContentProps({
              contentType: feed.contentType,
              content: translation.content,
            })}
            context={{
              updatedAt: feed.updatedAt,
              type: feed.contentType,
              tocContents: {
                label: t("otp"),
                updated: t("last-updated"),
              },
              locale,
            }}
          />
        </Suspense>
        <WrittenBy
          className="w-full flex justify-start mt-10 relative self-start"
          author="Chia1104"
        />
      </div>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
    </ViewTransition>
  );
};

export default Page;
