"use client";

import { FC, useMemo } from "react";

import type { RouterInputs, RouterOutputs } from "@chia/api";
import { FeedType } from "@chia/db/types";
import Timeline from "@chia/ui/timeline";
import type { Data } from "@chia/ui/timeline/types";

import DateFormat from "@/components/commons/date-format";
import { api } from "@/trpc/client";

interface Props {
  initialData: RouterOutputs["feeds"]["getFeedsWithMetaByAdminId"]["items"];
  query?: RouterInputs["feeds"]["getFeedsWithMetaByAdminId"];
  nextCursor?: string | number | Date;
  type: FeedType;
}

const FeedList: FC<Props> = ({ initialData, nextCursor, query = {}, type }) => {
  const { data, isSuccess, isFetching, isError, fetchNextPage, hasNextPage } =
    api.feeds.getFeedsWithMetaByAdminId.useInfiniteQuery(
      { ...query, type },
      {
        getNextPageParam: (lastPage) => lastPage.nextCursor,
        initialData: {
          pages: [
            {
              items: initialData,
              nextCursor: nextCursor?.toString(),
            },
          ],
          pageParams: [nextCursor?.toString()],
        },
      }
    );

  const getLinkPrefix = () => {
    switch (type) {
      case FeedType.Note:
        return "/notes";
      case FeedType.Post:
        return "/posts";
      default:
        return "";
    }
  };

  const transformData = useMemo(() => {
    if ((!isSuccess && !data) || isError) return [];
    return data.pages.flatMap((page) =>
      page.items.map((item) => {
        const { id, title, createdAt, excerpt, slug } = item;
        return {
          id,
          title,
          titleProps: {
            className: "line-clamp-1",
          },
          subtitle: <DateFormat date={createdAt} format="MMMM D, YYYY" />,
          startDate: createdAt,
          content: excerpt,
          link: `${getLinkPrefix()}/${slug}`,
        } satisfies Data;
      })
    );
  }, [isSuccess, data, isError, getLinkPrefix]);

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
