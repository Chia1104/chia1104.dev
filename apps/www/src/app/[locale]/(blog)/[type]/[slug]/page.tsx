import { Suspense, ViewTransition } from "react";

import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { cacheLife } from "next/cache";
import { notFound } from "next/navigation";
import { RedirectType } from "next/navigation";
import type { Blog, WithContext } from "schema-dts";

import { Content } from "@chia/contents/content.rsc";
import { getContentProps } from "@chia/contents/services";
import DateFormat from "@chia/ui/date-format";
import Image from "@chia/ui/image";
import dayjs from "@chia/utils/day";

import FeedTranslationWarning from "@/components/blog/feed-translation-warning";
import WrittenBy from "@/components/blog/written-by";
import AppLoading from "@/components/commons/app-loading";
import { redirect } from "@/i18n/routing";
import { getFeedBySlug, getFeeds } from "@/services/feeds.service";
import { Locale } from "@/utils/i18n";

const getFeedBySlugWithCache = async (slug: string) => {
  "use cache";
  cacheLife({
    revalidate: 120,
  });

  return getFeedBySlug(slug);
};

export const generateStaticParams = async () => {
  const feeds = await getFeeds(100);

  return feeds.items.map((feed) => ({
    type: feed.type,
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
    const feed = await getFeedBySlugWithCache(slug);
    if (!feed) return {};
    return {
      title: feed.title,
      description: feed.excerpt,
    };
  } catch (error) {
    console.error(error);
    notFound();
  }
};

const ContentWithCache = async ({
  feed,
  locale,
  tocContents,
}: {
  feed: NonNullable<Awaited<ReturnType<typeof getFeedBySlugWithCache>>>;
  locale: Locale;
  tocContents: {
    label: string;
    updated: string;
  };
  // eslint-disable-next-line @typescript-eslint/require-await
}) => {
  "use cache";
  cacheLife({
    revalidate: 120,
  });

  return (
    <Content
      content={getContentProps({
        contentType: feed.contentType,
        content: feed.content,
      })}
      context={{
        updatedAt: feed.updatedAt,
        type: feed.contentType,
        tocContents,
        locale,
      }}
    />
  );
};

const Page = async ({
  params,
}: {
  params: PageParamsWithLocale<{
    type: "post" | "note";
    slug: string;
  }>;
}) => {
  const { slug, locale, type } = await params;
  const feed = await getFeedBySlugWithCache(slug);
  const t = await getTranslations("blog");

  if (!feed?.content) {
    notFound();
  } else if (`${feed.type}` !== type) {
    redirect(
      {
        href: `/${feed.type}/${feed.slug}`,
        locale,
      },
      RedirectType.replace
    );
  }

  const jsonLd: WithContext<Blog> = {
    "@context": "https://schema.org",
    "@type": "Blog",
    headline: feed.title,
    datePublished: dayjs(feed.createdAt).format("MMMM D, YYYY"),
    dateModified: dayjs(feed.updatedAt).format("MMMM D, YYYY"),
    name: feed.title,
    description: feed.excerpt ?? "",
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
                {feed.title}
              </h1>
            </ViewTransition>
          </div>
          <p>{feed.description}</p>
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
          <ContentWithCache
            feed={feed}
            locale={locale}
            tocContents={{
              label: t("otp"),
              updated: t("last-updated"),
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
