import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense, ViewTransition } from "react";

import { ErrorBoundary } from "@sentry/nextjs";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { getLocale, getTranslations } from "next-intl/server";

import { FeedType } from "@chia/db/types";
import type { Locale as DBLocale } from "@chia/db/types";
import { getQueryClient } from "@chia/utils/query-client";

import FeedList from "@/components/blog/feed-list";
import AppLoading from "@/components/commons/app-loading";
import { client, orpc } from "@/libs/orpc/client.rsc";
import type { RouterInputs } from "@/libs/orpc/types";
import { dbLocaleResolver } from "@/libs/utils/i18n";

export const revalidate = 300;

export const generateStaticParams = async () => {
  const { items } = await client.tags.list();
  return items.map((tag) => ({ slug: tag.slug }));
};

/** The tag named for `locale`; `null` when no tag has the slug. */
const findTag = async (slug: string, locale: DBLocale) => {
  const { items } = await client.tags.list();
  const tag = items.find((candidate) => candidate.slug === slug);
  if (!tag) return null;
  return {
    ...tag,
    name: tag.translations[locale]?.name ?? tag.slug,
    description: tag.translations[locale]?.description ?? null,
  };
};

export const generateMetadata = async ({
  params,
}: {
  params: PageParamsWithLocale<{ slug: string }>;
}): Promise<Metadata> => {
  const [{ slug }, locale] = await Promise.all([params, getLocale()]);
  const tag = await findTag(slug, dbLocaleResolver(locale));
  if (!tag) notFound();
  return {
    title: tag.name,
    description: tag.description ?? undefined,
    keywords: [tag.name],
  };
};

const LIMIT = 10;

const CacheFeeds = async ({
  query,
}: {
  query: RouterInputs["feeds"]["list"];
}) => {
  const queryClient = getQueryClient();
  await queryClient.infiniteQuery(
    orpc.feeds.list.infiniteOptions({
      input: () => query,
      initialPageParam: null,
      getNextPageParam: (lastPage) => lastPage.nextCursor,
    })
  );
  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <FeedList nextCursor={null} query={query} />
    </HydrationBoundary>
  );
};

const Page = async ({
  params,
}: {
  params: PageParamsWithLocale<{ slug: string }>;
}) => {
  const [{ slug }, locale] = await Promise.all([params, getLocale()]);
  const dbLocale = dbLocaleResolver(locale);
  const [tag, t] = await Promise.all([
    findTag(slug, dbLocale),
    getTranslations("blog.tags"),
  ]);
  if (!tag) notFound();

  return (
    <ViewTransition>
      <div className="w-full">
        <p className="text-muted mb-0">{t("doc-title")}</p>
        <h1 className="mt-0">{tag.name}</h1>
        {tag.description ? <p>{tag.description}</p> : null}
        <ErrorBoundary>
          <Suspense fallback={<AppLoading />}>
            <CacheFeeds
              query={{
                limit: LIMIT,
                orderBy: "createdAt",
                sortOrder: "desc",
                type: FeedType.All,
                tag: slug,
                locale: dbLocale,
              }}
            />
          </Suspense>
        </ErrorBoundary>
      </div>
    </ViewTransition>
  );
};

export default Page;
