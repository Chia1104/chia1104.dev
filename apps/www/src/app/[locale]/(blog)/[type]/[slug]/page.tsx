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
import { FeedSummary } from "@/components/blog/feed-summary";
import { FeedTags } from "@/components/blog/feed-tags";
import {
  RelatedFeeds,
  RelatedFeedsSkeleton,
} from "@/components/blog/related-feeds";
import { Tweet } from "@/components/blog/tweet";
import WrittenBy from "@/components/blog/written-by";
import {
  Band,
  PageDescription,
  PageTitle,
  Panel,
} from "@/components/commons/ruled";
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
      <article className="flex w-full flex-col">
        <header className="flex flex-col">
          <PageTitle>
            <ViewTransition name={`view-transition-link-${feed.id}`}>
              <span
                className="inline-block"
                style={{
                  viewTransitionName: `view-transition-link-${feed.id}`,
                }}>
                {translation.title}
              </span>
            </ViewTransition>
          </PageTitle>
          {translation.description ? (
            <PageDescription>{translation.description}</PageDescription>
          ) : null}
          <FeedTags className="rule-b px-4 py-3" tags={feed.tags} />
          <div className="rule-b page-sm:flex-row flex flex-col">
            <div className="border-separator page-sm:border-b-0 flex items-center gap-2 border-b px-4 py-2">
              <Avatar size="sm">
                <Avatar.Image src={Meta.avatar} />
                <Avatar.Fallback>
                  <span>{Meta.name.charAt(0)}</span>
                </Avatar.Fallback>
              </Avatar>
              <span className="text-sm font-medium">{Meta.name}</span>
            </div>
            <ul
              id="feed-meta"
              className="border-separator divide-separator text-muted page-sm:ml-auto page-sm:border-l flex divide-x text-sm tabular-nums">
              <li className="flex items-center px-4 py-2">
                <ViewTransition>
                  <DateFormat
                    date={feed.createdAt}
                    format="MMM D, YYYY"
                    locale={locale}
                  />
                </ViewTransition>
              </li>
              <li className="flex items-center px-4 py-2">
                {t(`${feed.type}s.doc-title`)}
              </li>
              {translation.readTime ? (
                <li className="flex items-center px-4 py-2">
                  {t("read-with-minutes", {
                    minutes: translation.readTime,
                  })}
                </li>
              ) : null}
            </ul>
          </div>
        </header>
        <div className="rule-b px-4 pt-6 pb-12">
          {translation.summary ? (
            <FeedSummary label={t("summary")} summary={translation.summary} />
          ) : null}
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
                      content={translation.content}
                      articleUrl={articleUrl}
                      className="mb-5 ml-auto flex justify-self-end"
                    />
                  ),
                },
              }}
            />
          </ArticleAgentContext>
        </div>
        <Band />
        <ErrorBoundary>
          <Suspense fallback={<RelatedFeedsSkeleton />}>
            <RelatedFeeds locale={locale} slug={slug} />
          </Suspense>
        </ErrorBoundary>
        <Panel className="px-4 py-6">
          <WrittenBy
            className="relative flex w-full justify-start self-start"
            author="Chia1104"
          />
        </Panel>
      </article>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
    </ViewTransition>
  );
};

export default Page;
