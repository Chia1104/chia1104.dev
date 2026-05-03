import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense, ViewTransition } from "react";

import { ErrorBoundary } from "@sentry/nextjs";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { getTranslations } from "next-intl/server";

import dayjs from "@chia/utils/day";

import FeedList from "@/components/blog/feed-list";
import AppLoading from "@/components/commons/app-loading";
import { orpc } from "@/libs/orpc/client.rsc";
import { dbLocaleResolver } from "@/libs/utils/i18n";
import { getQueryClient } from "@/libs/utils/query-client";

export const generateStaticParams = () => {
  return [{ type: "posts" }, { type: "notes" }];
};

export async function generateMetadata({
  params,
}: PagePropsWithLocale<{ type: "posts" | "notes" }>): Promise<Metadata> {
  const { type } = await params;
  if (!["posts", "notes"].includes(type)) {
    notFound();
  }
  const t = await getTranslations(`blog.${type}`);
  return {
    title: t("doc-title"),
  };
}

const CacheFeeds = async ({
  type,
  limit = 10,
  locale,
}: {
  type: "posts" | "notes";
  limit?: number;
  locale: Locale;
}) => {
  const queryClient = getQueryClient();
  const formattedType = type === "posts" ? "post" : "note";

  await queryClient.prefetchInfiniteQuery(
    orpc.feeds["admin-list"].infiniteOptions({
      input: () => ({
        limit,
        orderBy: "createdAt",
        sortOrder: "desc",
        type: formattedType,
        cursor: null,
        locale: dbLocaleResolver(locale),
      }),
      initialPageParam: null,
      getNextPageParam: (lastPage) => {
        if (!lastPage.nextCursor) return null;
        return dayjs(lastPage.nextCursor).toISOString();
      },
    })
  );

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <FeedList
        type={formattedType}
        nextCursor={null}
        query={{
          limit,
          orderBy: "createdAt",
          sortOrder: "desc",
          type: formattedType,
          locale: dbLocaleResolver(locale),
        }}
      />
    </HydrationBoundary>
  );
};

const Page = async (
  props: PagePropsWithLocale<{ type: "posts" | "notes" }>
) => {
  const { type, locale } = await props.params;

  if (!["posts", "notes"].includes(type)) {
    notFound();
  }

  const t = await getTranslations(`blog.${type}`);
  return (
    <ViewTransition>
      <div className="w-full">
        <h1>{t("doc-title")}</h1>
        <ErrorBoundary>
          <Suspense fallback={<AppLoading />}>
            <CacheFeeds type={type} limit={10} locale={locale} />
          </Suspense>
        </ErrorBoundary>
      </div>
    </ViewTransition>
  );
};

export default Page;
