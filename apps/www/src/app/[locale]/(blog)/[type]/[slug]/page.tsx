import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense, ViewTransition } from "react";

import { Avatar } from "@heroui/react";
import { safe } from "@orpc/client";
import { ErrorBoundary } from "@sentry/nextjs";
import { all } from "better-all";
import { getLocale, getTranslations } from "next-intl/server";
import type { Blog, WithContext } from "schema-dts";

import { Content } from "@chia/contents/content.rsc";
import { getContentProps } from "@chia/contents/services";
import { FeedOrderBy, FeedType } from "@chia/db/types";
import Meta from "@chia/meta";
import DateFormat from "@chia/ui/date-format";
import { WWW_BASE_URL, getBaseUrl } from "@chia/utils/config";
import dayjs from "@chia/utils/day";

import { ArticleAgentContext } from "@/components/agent/article-agent-context";
import { ActionGroup } from "@/components/blog/action-group";
import { FeedTags } from "@/components/blog/feed-tags";
import {
  RelatedFeeds,
  RelatedFeedsSkeleton,
} from "@/components/blog/related-feeds";
import { Tweet } from "@/components/blog/tweet";
import WrittenBy from "@/components/blog/written-by";
import { client } from "@/libs/orpc/client.rsc";
import { reportServiceError } from "@/libs/orpc/report";
import { dbLocaleResolver } from "@/libs/utils/i18n";

export const revalidate = 300;

export const generateStaticParams = async () => {
  const feeds = await client.feeds.list({
    limit: 100,
    type: FeedType.All,
    withContent: false,
    orderBy: FeedOrderBy.CreatedAt,
    sortOrder: "desc",
  });

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
  const [{ slug }, locale] = await Promise.all([params, getLocale()]);
  try {
    const feed = await client.feeds["details-by-slug"]({
      slug,
      locale: dbLocaleResolver(locale),
    });
    const tags = feed.tags.map((tag) => tag.name);
    return {
      title: feed.translations[0]?.title,
      description: feed.translations[0]?.description,
      keywords: tags,
      openGraph: {
        type: "article",
        publishedTime: dayjs(feed.createdAt).toISOString(),
        modifiedTime: dayjs(feed.updatedAt).toISOString(),
        authors: [Meta.name],
        tags,
      },
    };
  } catch (error) {
    reportServiceError(error);
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
  const [{ slug, type }, locale] = await Promise.all([params, getLocale()]);
  const dbLocale = dbLocaleResolver(locale);
  const { feed, t } = await all({
    feed: async () => {
      const { error, data } = await safe(
        client.feeds["details-by-slug"]({ slug, locale: dbLocale })
      );
      if (error) {
        reportServiceError(error);
        return null;
      }
      return data;
    },
    t: async () => await getTranslations("blog"),
  });

  const [translation] = feed?.translations ?? [];

  if (!translation?.content || !feed) {
    notFound();
  }

  const articleUrl = `${getBaseUrl({
    baseUrl: WWW_BASE_URL,
    useBaseUrl: true,
  })}/${locale}/${type}/${slug}/llm.md`;

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
    keywords: feed.tags.map((tag) => tag.name),
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
          <FeedTags className="mt-3" tags={feed.tags} />
          <div className="mt-5 flex items-center justify-between ">
            <div className="not-prose flex items-center gap-2">
              <Avatar>
                <Avatar.Image src={Meta.avatar} />
                <Avatar.Fallback>
                  <span>{Meta.name.charAt(0)}</span>
                </Avatar.Fallback>
              </Avatar>
              <span className="page-sm:block hidden">{Meta.name}</span>
            </div>
            <div
              id="feed-meta"
              className="text-foreground-700 flex flex-col items-end sm:flex-row sm:items-center">
              <div className="flex items-center">
                <ViewTransition>
                  <DateFormat
                    date={feed.createdAt}
                    format="MMMM D, YYYY"
                    locale={locale}
                  />
                </ViewTransition>
                <i className="i-mdi-dot hidden sm:block" />
              </div>
              <div className="flex items-center">
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
          </div>
        </header>
        <ArticleAgentContext
          feedId={feed.id}
          locale={dbLocale}
          title={translation.title}>
          <Content
            content={getContentProps({
              content: translation.content,
              components: { Tweet },
            })}
            context={{
              updatedAt: feed.updatedAt,
              tocContents: {
                label: t("otp"),
                updated: t("last-updated"),
              },
              locale,
              slot: {
                actions: (
                  <ActionGroup
                    content={feed.translations[0]?.content}
                    articleUrl={articleUrl}
                    className="mb-5 ml-auto flex justify-self-end"
                  />
                ),
              },
            }}
          />
        </ArticleAgentContext>
        <ErrorBoundary>
          <Suspense fallback={<RelatedFeedsSkeleton />}>
            <RelatedFeeds locale={locale} slug={slug} />
          </Suspense>
        </ErrorBoundary>
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
