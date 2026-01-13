"use client";

import type { FC } from "react";
import { useMemo, useCallback } from "react";

import { useInfiniteQuery } from "@tanstack/react-query";
import { useLocale } from "next-intl";

import { FeedType } from "@chia/db/types";
import DateFormat from "@chia/ui/date-format";
import Timeline from "@chia/ui/timeline";
import type { Data } from "@chia/ui/timeline/types";
import dayjs from "@chia/utils/day";

import { orpc } from "@/libs/orpc/client";
import type { RouterInputs, RouterOutputs } from "@/libs/orpc/types";

interface Props {
  initialData: RouterOutputs["feeds"]["list"]["items"];
  query?: RouterInputs["feeds"]["list"];
  nextCursor?: string | number | null;
  type: FeedType;
}

const FeedList: FC<Props> = ({ initialData, nextCursor, query = {}, type }) => {
  const locale = useLocale();
  const { data, isSuccess, isFetching, isError, fetchNextPage, hasNextPage } =
    useInfiniteQuery(
      orpc.feeds["admin-list"].infiniteOptions({
        input: (pageParam) => ({
          ...query,
          cursor: pageParam,
        }),
        getNextPageParam: (lastPage) =>
          lastPage.nextCursor ? lastPage.nextCursor.toString() : null,
        initialData: {
          pages: [
            {
              items: initialData,
              nextCursor: nextCursor?.toString() ?? null,
            },
          ],
          pageParams: [nextCursor?.toString() ?? null],
        },
        initialPageParam: nextCursor?.toString() ?? null,
      })
    );

  const getLinkPrefix = useCallback(() => {
    switch (type) {
      case FeedType.Note:
        return "/note";
      case FeedType.Post:
        return "/post";
      default:
        return "";
    }
  }, [type]);

  const transformData = useMemo(() => {
    if ((!isSuccess && !data) || isError) return [];
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
        } satisfies Data;
      })
    );
  }, [isSuccess, data, isError, locale, getLinkPrefix]);

  return (
    <Timeline
      data={transformData}
      enableSort={false}
      asyncDataStatus={{
        hasMore: hasNextPage,
        isLoading: isFetching,
        isError,
      }}
      onEndReached={fetchNextPage}
    />
  );
};

export default FeedList;
