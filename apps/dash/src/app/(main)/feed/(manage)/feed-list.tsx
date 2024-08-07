"use client";

import { forwardRef, useMemo, memo } from "react";
import type { ReactNode } from "react";
import type { FC } from "react";

import { Card, CardBody, CardHeader } from "@nextui-org/react";
import dayjs from "dayjs";

import type { RouterInputs, RouterOutputs } from "@chia/api";
import { useInfiniteScroll } from "@chia/ui";

import { api } from "@/trpc-api";

import Skeleton from "./skeleton";

interface Props {
  initFeed?: RouterOutputs["feeds"]["infinite"]["items"];
  nextCursor?: string | number | Date;
  useClient?: boolean;
  query?: RouterInputs["feeds"]["infinite"];
  title?: ReactNode;
}

const FeedItem = forwardRef<
  HTMLDivElement,
  { feed: RouterOutputs["feeds"]["infinite"]["items"][0] }
>(({ feed }, ref) => {
  return (
    <Card ref={ref} className="dark:bg-dark/90 grid-cols-1">
      <CardHeader>
        <h4 className="font-medium text-large line-clamp-2">{feed.title}</h4>
      </CardHeader>
      <CardBody className="gap-2">
        <p className="text-tiny font-bold mt-auto line-clamp-2">
          {feed.excerpt}
        </p>
        <p className="text-tiny font-bold">
          {dayjs(feed.createdAt).format("MMMM D, YYYY")}
        </p>
      </CardBody>
    </Card>
  );
});
FeedItem.displayName = "FeedItem";

const FeedList: FC<Props> = (props) => {
  const { initFeed, nextCursor, query = {} } = props;

  const { data, isSuccess, fetchNextPage, hasNextPage, isFetchingNextPage } =
    api.feeds.infinite.useInfiniteQuery(query, {
      getNextPageParam: (lastPage) => lastPage?.nextCursor,
      initialData: initFeed
        ? {
            pages: [
              {
                items: initFeed,
                nextCursor: nextCursor?.toString(),
              },
            ],
            pageParams: [nextCursor?.toString()],
          }
        : undefined,
    });

  const flatData = useMemo(() => {
    if (!isSuccess || !data) return [];
    return data.pages.flatMap((page) => page.items);
  }, [data, isSuccess]);

  const { ref } = useInfiniteScroll<HTMLDivElement>({
    hasMore: hasNextPage,
    isLoading: isFetchingNextPage,
    onLoadMore: () => void fetchNextPage(),
    intersectionObserverInit: {
      rootMargin: "0px 0px 200px 0px",
    },
  });
  return (
    <div className="w-full">
      <h2 className="mb-10 text-4xl">{props.title}</h2>
      <div className="grid gap-5 grid-cols-1 md:grid-cols-2">
        {isSuccess &&
          !!flatData &&
          flatData.map((feed, index) => {
            if (flatData.length === index + 1) {
              return <FeedItem key={feed.id} ref={ref} feed={feed} />;
            }
            return <FeedItem key={feed.id} feed={feed} />;
          })}
        {isFetchingNextPage && <Skeleton />}
      </div>
    </div>
  );
};

export default memo(FeedList, (prev, next) => {
  return prev.initFeed === next.initFeed;
});
