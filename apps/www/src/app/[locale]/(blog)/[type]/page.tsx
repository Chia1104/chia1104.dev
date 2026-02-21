import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense, ViewTransition } from "react";

import { ErrorBoundary } from "@sentry/nextjs";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { getTranslations } from "next-intl/server";

import Image from "@chia/ui/image";
import ImageZoom from "@chia/ui/image-zoom";

import FeedList from "@/components/blog/feed-list";
import AppLoading from "@/components/commons/app-loading";
import { orpc } from "@/libs/orpc/client";
import { dbLocaleResolver } from "@/libs/utils/i18n";
import { getQueryClient } from "@/libs/utils/query-client";
import { getFeedsWithType } from "@/services/feeds.service";

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

const queryClient = getQueryClient();

const CacheFeeds = async ({
  type,
  limit = 10,
  locale,
}: {
  type: "posts" | "notes";
  limit?: number;
  locale: Locale;
}) => {
  const formattedType = type === "posts" ? "post" : "note";
  const t = await getTranslations(`blog.${type}`);

  const feeds = await queryClient.fetchInfiniteQuery({
    queryKey: orpc.feeds["admin-list"].infiniteKey({
      input: () => ({
        limit,
        orderBy: "createdAt",
        sortOrder: "desc",
        type: formattedType,
        cursor: null,
        locale: dbLocaleResolver(locale),
      }),
      initialPageParam: null,
    }),
    queryFn: () =>
      getFeedsWithType(formattedType, limit, dbLocaleResolver(locale)),
    initialPageParam: null,
  });

  const hasFeeds =
    Array.isArray(feeds?.pages[0]?.items) && feeds?.pages[0]?.items.length > 0;

  return hasFeeds ? (
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
  ) : (
    <div className="c-bg-third relative flex flex-col items-center justify-center overflow-hidden rounded-lg px-5 py-10">
      <p>{t("no-content")}</p>
      <ImageZoom>
        <div className="not-prose relative aspect-square w-[100px]">
          <Image
            src="https://storage.chia1104.dev/memo.png"
            alt="memo"
            className="object-cover"
            fill
            loading="lazy"
          />
        </div>
      </ImageZoom>
      <div className="dark:c-bg-gradient-purple-to-pink c-bg-gradient-yellow-to-pink absolute -z-40 size-full opacity-50 blur-3xl" />
    </div>
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
