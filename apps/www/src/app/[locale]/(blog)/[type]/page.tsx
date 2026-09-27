import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense, ViewTransition } from "react";

import { ErrorBoundary } from "@sentry/nextjs";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { getLocale, getTranslations } from "next-intl/server";

import { getQueryClient } from "@chia/utils/query-client";

import FeedList from "@/components/blog/feed-list";
import AppLoading from "@/components/commons/app-loading";
import { PageDescription, PageTitle } from "@/components/commons/ruled";
import { localizedMetadata } from "@/libs/i18n/alternates";
import { orpc } from "@/libs/orpc/client.rsc";
import { dbLocaleResolver } from "@/libs/utils/i18n";
import { FEED_PAGE_SIZE } from "@/shared/feeds";

export const generateStaticParams = () => {
  return [{ type: "posts" }, { type: "notes" }];
};

/** Any other first segment is a 404 served without rendering, so a scanner leaves no cache entry. */
export const dynamicParams = false;

export async function generateMetadata({
  params,
}: PagePropsWithLocale<{ type: "posts" | "notes" }>): Promise<Metadata> {
  const [{ type }, locale] = await Promise.all([params, getLocale()]);
  if (!["posts", "notes"].includes(type)) {
    notFound();
  }
  const t = await getTranslations(`blog.${type}`);
  return {
    title: t("doc-title"),
    description: t("description"),
    ...localizedMetadata({ href: `/${type}`, locale }),
  };
}

const CacheFeeds = async ({
  type,
  limit = FEED_PAGE_SIZE,
  locale,
}: {
  type: "posts" | "notes";
  limit?: number;
  locale: Locale;
}) => {
  const queryClient = getQueryClient();
  const formattedType = type === "posts" ? "post" : "note";

  await queryClient.infiniteQuery(
    orpc.feeds.list.infiniteOptions({
      input: () => ({
        limit,
        orderBy: "createdAt",
        sortOrder: "desc",
        type: formattedType,
        locale: dbLocaleResolver(locale),
        translated: true,
      }),
      initialPageParam: null,
      getNextPageParam: (lastPage) => lastPage.nextCursor,
    })
  );

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <FeedList
        nextCursor={null}
        query={{
          limit,
          orderBy: "createdAt",
          sortOrder: "desc",
          type: formattedType,
          locale: dbLocaleResolver(locale),
          translated: true,
        }}
      />
    </HydrationBoundary>
  );
};

const Page = async (
  props: PagePropsWithLocale<{ type: "posts" | "notes" }>
) => {
  const [{ type }, locale] = await Promise.all([props.params, getLocale()]);

  if (!["posts", "notes"].includes(type)) {
    notFound();
  }

  const t = await getTranslations(`blog.${type}`);
  return (
    <ViewTransition>
      <div className="flex w-full flex-col">
        <PageTitle>{t("doc-title")}</PageTitle>
        <PageDescription>{t("description")}</PageDescription>
        <ErrorBoundary>
          <Suspense fallback={<AppLoading className="py-12" spinnerOnly />}>
            <CacheFeeds type={type} locale={locale} />
          </Suspense>
        </ErrorBoundary>
      </div>
    </ViewTransition>
  );
};

export default Page;
