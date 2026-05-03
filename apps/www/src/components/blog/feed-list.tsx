"use client";

import type { FC } from "react";
import { useMemo, useCallback } from "react";

import { useInfiniteQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";

import { FeedOrderBy, FeedType } from "@chia/db/types";
import DateFormat from "@chia/ui/date-format";
import Image from "@chia/ui/image";
import ImageZoom from "@chia/ui/image-zoom";
import Timeline from "@chia/ui/timeline";
import type { TimelineItemData } from "@chia/ui/timeline/types";
import dayjs from "@chia/utils/day";

import { orpc } from "@/libs/orpc/client";
import type { RouterInputs } from "@/libs/orpc/types";

interface Props {
  query?: RouterInputs["feeds"]["list"];
  nextCursor?: string | number | null;
  type: FeedType;
}

const FeedList: FC<Props> = ({ nextCursor, query = {}, type }) => {
  const locale = useLocale();
  const t = useTranslations(`blog.posts`);
  const { data, isSuccess, isLoading, isError, fetchNextPage, hasNextPage } =
    useInfiniteQuery(
      orpc.feeds["admin-list"].infiniteOptions({
        input: (pageParam) => ({
          ...query,
          cursor: pageParam,
        }),
        getNextPageParam: (lastPage) => {
          if (!lastPage.nextCursor) return null;

          if (
            query.orderBy === FeedOrderBy.CreatedAt ||
            query.orderBy === FeedOrderBy.UpdatedAt
          ) {
            return dayjs(lastPage.nextCursor).toISOString();
          }

          return lastPage.nextCursor.toString();
        },
        initialPageParam: nextCursor?.toString() ?? null,
      })
    );

  const getLinkPrefix = useCallback(() => {
    switch (type) {
      case FeedType.Note:
        return "/notes";
      case FeedType.Post:
        return "/posts";
      default:
        return "";
    }
  }, [type]);

  const transformData = useMemo(() => {
    if ((!isSuccess && !data) || (isError && !data)) return [];
    return data.pages.flatMap((page) =>
      page.items.map((item) => {
        const { id, createdAt, slug, translations } = item;
        return {
          id,
          title: translations[0]?.title,
          titleProps: {
            className: "line-clamp-1",
          },
          subtitle: (
            <DateFormat
              date={createdAt}
              format="MMMM D, YYYY"
              locale={locale}
            />
          ),
          startDate: createdAt ? dayjs(createdAt) : null,
          content: translations[0]?.description,
          link: `${getLinkPrefix()}/${slug}`,
        } satisfies TimelineItemData;
      })
    );
  }, [isSuccess, data, isError, locale, getLinkPrefix]);

  if (isSuccess && transformData.length === 0) {
    return (
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
