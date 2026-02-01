import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { Suspense, ViewTransition } from "react";

import { all } from "better-all";
import type { Blog, WithContext } from "schema-dts";

import { Content } from "@chia/contents/content.rsc";
import { getContentProps } from "@chia/contents/services";
import DateFormat from "@chia/ui/date-format";
import Image from "@chia/ui/image";
import { WWW_BASE_URL, getBaseUrl } from "@chia/utils/config";
import dayjs from "@chia/utils/day";

import { ActionGroup } from "@/components/blog/action-group";
import TocFooterMeta from "@/components/blog/toc-footer-meta";
import WrittenBy from "@/components/blog/written-by";
import AppLoading from "@/components/commons/app-loading";
import { getFeedBySlug, getFeeds } from "@/services/feeds.service";

export const revalidate = 300;

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
  const { slug, locale, type } = await params;
  const feed = await getFeedBySlug(slug);
  const { t } = await all({
    t: async () => await getTranslations("blog"),
  });

  const [translation] = feed?.translations ?? [];

  if (!translation?.content || !feed) {
    notFound();
  }

  const articleUrl = `${getBaseUrl({
    baseUrl: WWW_BASE_URL,
    useBaseUrl: true,
  })}/${locale}/${type}/${slug}`;

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
        <header className="mt-5 mb-5 w-full self-center">
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
          <ActionGroup
            content={feed.translations[0]?.content?.content}
            articleUrl={articleUrl}
            className="mt-5 flex justify-end lg:hidden"
          />
          <div className="mt-5 flex flex-col items-start lg:flex-row lg:items-center lg:justify-between">
            <div className="not-prose flex items-center gap-2">
              <Image
                src="https://avatars.githubusercontent.com/u/38397958?v=4"
                width={40}
                height={40}
                className="rounded-full"
                alt="Chia1104"
              />
              <span>Chia1104</span>
            </div>
            <div
              id="feed-meta"
              className="text-foreground-700 flex items-center">
              <ViewTransition>
                <DateFormat
                  date={feed.createdAt}
                  format="MMMM D, YYYY"
                  locale={locale}
                />
              </ViewTransition>
              <i className="i-mdi-dot" />
              <span>{t(`${feed.type}s.doc-title`)}</span>
              {feed.translations[0]?.readTime ? (
                <>
                  <i className="i-mdi-dot" />
                  <span>
                    {t("read-with-minutes", {
                      minutes: feed.translations[0]?.readTime,
                    })}
                  </span>
                </>
              ) : null}
            </div>
          </div>
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
              slot: {
                afterLastUpdate: (
                  <TocFooterMeta
                    readTimeText={
                      feed.translations[0]?.readTime
                        ? t("read-with-minutes", {
                            minutes: feed.translations[0]?.readTime,
                          })
                        : undefined
                    }
                  />
                ),
                tocFooter: (
                  <ActionGroup
                    content={feed.translations[0]?.content?.content}
                    articleUrl={articleUrl}
                    className="mt-5 hidden self-end md:flex"
                  />
                ),
              },
            }}
          />
        </Suspense>
        <WrittenBy
          className="relative mt-10 flex w-full justify-start self-start"
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
