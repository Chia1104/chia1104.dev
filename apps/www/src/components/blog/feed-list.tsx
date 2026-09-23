"use client";

import type { FC } from "react";
import { useMemo } from "react";

import { useInfiniteQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";

import DateFormat from "@chia/ui/date-format";
import Image from "@chia/ui/image";
import ImageZoom from "@chia/ui/image-zoom";
import Timeline from "@chia/ui/timeline";
import type { TimelineItemData } from "@chia/ui/timeline/types";

import { orpc } from "@/libs/orpc/client";
import type { RouterInputs } from "@/libs/orpc/types";

import { FeedTags } from "./feed-tags";

interface Props {
  query?: RouterInputs["feeds"]["list"];
  nextCursor?: string | null;
}

const FeedList: FC<Props> = ({ nextCursor, query = {} }) => {
  const locale = useLocale();
  const t = useTranslations(`blog.posts`);
  const { data, isSuccess, isLoading, isError, fetchNextPage, hasNextPage } =
    useInfiniteQuery(
      orpc.feeds.list.infiniteOptions({
        // Omit `nextCursor` on the first page — `null` is not a valid cursor value.
        input: (pageParam) => ({
          ...query,
          nextCursor: pageParam ?? undefined,
        }),
        getNextPageParam: (lastPage) => lastPage.nextCursor,
        initialPageParam: nextCursor ?? null,
      })
    );

  const transformData = useMemo(() => {
    if ((!isSuccess && !data) || (isError && !data)) return [];
    return data.pages.flatMap((page) =>
      page.items.map((item) => {
        const { id, createdAt, slug, translations, tags } = item;
        return {
          id,
          title: translations[0]?.title,
          titleProps: {
            className: "line-clamp-1",
          },
          subtitle: (
            <>
              <DateFormat
                date={createdAt}
                format="MMMM D, YYYY"
                locale={locale}
              />
              <FeedTags tags={tags} />
            </>
          ),
          subtitleProps: {
            className: "flex flex-wrap items-center gap-x-3 gap-y-1",
          },
          startDate: createdAt ?? null,
          content: translations[0]?.description,
          link: `/${item.type}s/${slug}`,
        } satisfies TimelineItemData;
      })
    );
  }, [isSuccess, data, isError, locale]);

  if (isSuccess && transformData.length === 0) {
    return (
      <div className="c-bg-third relative flex flex-col items-center justify-center overflow-hidden rounded-3xl px-5 py-10">
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
  }

  return (
    <Timeline
      data={transformData}
      enableSort={false}
      asyncDataStatus={{
        hasMore: hasNextPage,
        isLoading,
        isError,
      }}
      onEndReached={fetchNextPage}
    />
  );
};

export default FeedList;
