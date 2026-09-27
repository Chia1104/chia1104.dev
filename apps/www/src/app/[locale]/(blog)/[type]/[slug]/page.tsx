import type { Metadata } from "next";
import { getImageProps } from "next/image";
import { notFound, permanentRedirect } from "next/navigation";
import { ViewTransition } from "react";

import { Avatar } from "@heroui/react";
import { safe } from "@orpc/client";
import { all } from "better-all";
import { getLocale, getTranslations } from "next-intl/server";
import type { Graph } from "schema-dts";

import { Content } from "@chia/contents/content.rsc";
import { getContentProps } from "@chia/contents/services";
import { FeedOrderBy, FeedType } from "@chia/db/types";
import Meta from "@chia/meta";
import DateFormat from "@chia/ui/date-format";
import { WWW_BASE_URL, wwwFeedCacheTag } from "@chia/utils/config";
import dayjs from "@chia/utils/day";

import { ArticleAgentContext } from "@/components/agent/article-agent-context";
import { ActionGroup } from "@/components/blog/action-group";
import { FeedSummary } from "@/components/blog/feed-summary";
import { FeedTags } from "@/components/blog/feed-tags";
import { RelatedFeeds } from "@/components/blog/related-feeds";
import { Tweet } from "@/components/blog/tweet";
import WrittenBy from "@/components/blog/written-by";
import {
  Band,
  PageDescription,
  PageTitle,
  Panel,
} from "@/components/commons/ruled";
import { localizedMetadata } from "@/libs/i18n/alternates";
import { getPathname } from "@/libs/i18n/navigation";
import { routing } from "@/libs/i18n/routing";
import { client } from "@/libs/orpc/client.rsc";
import { isServiceNotFound } from "@/libs/orpc/report";
import { dbLocaleResolver } from "@/libs/utils/i18n";

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

/** The feed with its `locale` translation; `null` when either does not exist. */
const readFeed = async (slug: string, locale: Locale) => {
  const { error, data } = await safe(
    client.feeds["details-by-slug"](
      { slug, locale: dbLocaleResolver(locale) },
      { context: { cacheTags: [wwwFeedCacheTag(slug)] } }
    )
  );
  if (isServiceNotFound(error)) return null;
  if (error) throw error;
  const [translation] = data.translations;
  return translation ? { feed: data, translation } : null;
};

export const generateMetadata = async ({
  params,
}: {
  params: PageParamsWithLocale<{
    slug: string;
  }>;
}): Promise<Metadata> => {
  const [{ slug }, locale] = await Promise.all([params, getLocale()]);
  const reads = await Promise.all(
    routing.locales.map(async (l) => ({
      locale: l,
      entry: await readFeed(slug, l),
    }))
  );
  const current = reads.find((read) => read.locale === locale)?.entry;
  if (!current) notFound();
  const { feed, translation } = current;
  const tags = feed.tags.map((tag) => tag.name);
  const localized = localizedMetadata({
    href: `/${feed.type}s/${slug}`,
    locale,
    locales: reads.filter((read) => read.entry).map((read) => read.locale),
  });
  return {
    title: translation.title,
    description: translation.description,
    keywords: tags,
    ...localized,
    openGraph: {
      ...localized.openGraph,
      type: "article",
      publishedTime: dayjs(feed.createdAt).toISOString(),
      modifiedTime: dayjs(feed.updatedAt).toISOString(),
      authors: [Meta.name],
      tags,
    },
  };
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
  const { entry, t } = await all({
    entry: async () => await readFeed(slug, locale),
    t: async () => await getTranslations("blog"),
  });

  if (!entry?.translation.content) {
    notFound();
  }
  const { feed, translation } = entry;
  const href = `/${feed.type}s/${slug}`;
  if (`${feed.type}s` !== type) {
    permanentRedirect(getPathname({ href, locale }));
  }

  const url = `${WWW_BASE_URL}${getPathname({ href, locale })}`;
  const jsonLd: Graph = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "BlogPosting",
        headline: translation.title,
        description: translation.description ?? undefined,
        url,
        mainEntityOfPage: url,
        datePublished: dayjs(feed.createdAt).toISOString(),
        dateModified: dayjs(feed.updatedAt).toISOString(),
        inLanguage: locale,
        author: {
          "@type": "Person",
          "@id": `${WWW_BASE_URL}/#person`,
          name: Meta.name,
          url: WWW_BASE_URL,
        },
        keywords: feed.tags.map((tag) => tag.name),
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          {
            "@type": "ListItem",
            position: 1,
            name: Meta.name,
            item: `${WWW_BASE_URL}${getPathname({ href: "/", locale })}`,
          },
          {
            "@type": "ListItem",
            position: 2,
            name: t(`${feed.type}s.doc-title`),
            item: `${WWW_BASE_URL}${getPathname({ href: `/${feed.type}s`, locale })}`,
          },
          { "@type": "ListItem", position: 3, name: translation.title },
        ],
      },
    ],
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
                <Avatar.Image
                  {...getImageProps({
                    src: Meta.avatar,
                    alt: "",
                    width: 32,
                    height: 32,
                  }).props}
                />
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
                      articleUrl={`${url}/llm.md`}
                      className="mb-5 ml-auto flex justify-self-end"
                    />
                  ),
                },
              }}
            />
          </ArticleAgentContext>
        </div>
        <Band />
        <RelatedFeeds slug={slug} />
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
