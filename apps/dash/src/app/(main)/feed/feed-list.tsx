"use client";

import { type FC, forwardRef, useMemo } from "react";
import { api } from "@/trpc-api";
import { useInfiniteScroll } from "@chia/ui";
import { Card, CardBody } from "@nextui-org/react";
import { type RouterInputs, type RouterOutputs } from "@chia/api";
import Skeleton from "./skeleton";

interface Props {
  initFeed?: RouterOutputs["post"]["infinite"]["items"];
  nextCursor?: string | number;
  useClient?: boolean;
  query?: RouterInputs["post"]["infinite"];
}

const FeedItem = forwardRef<
  HTMLDivElement,
  { feed: RouterOutputs["post"]["infinite"]["items"][0] }
>(({ feed }, ref) => {
  return (
    <Card ref={ref} className="dark:bg-dark/90">
      <CardBody>{feed.title}</CardBody>
    </Card>
  );
});
FeedItem.displayName = "FeedItem";

const FeedList: FC<Props> = (props) => {
  const { initFeed, nextCursor, query = {} } = props;
  const { data, isSuccess, isFetching, fetchNextPage, hasNextPage } =
    api.post.infinite.useInfiniteQuery(query, {
      getNextPageParam: (lastPage) => lastPage.nextCursor,
      initialData: !!initFeed
        ? {
            pages: [
              {
                items: initFeed,
                hasNextPage: true,
                nextCursor: nextCursor?.toString(),
              },
            ],
            pageParams: [undefined],
          }
        : {
            pages: [],
            pageParams: [],
          },
    });
  const flatData = useMemo(() => {
    if (!isSuccess || !data) return [];
    return data.pages.flatMap((page) => page.items);
  }, [data, isSuccess]);
  const { ref } = useInfiniteScroll({
    hasMore: hasNextPage,
    isLoading: isFetching,
    onLoadMore: fetchNextPage,
    intersectionObserverInit: {
      rootMargin: "0px 0px 200px 0px",
    },
  });
  return (
    <div>
      <h2 className="mb-10 text-4xl">FeedList</h2>
      <div className="flex flex-col gap-5">
        {isSuccess &&
          flatData?.map((feed) => {
            return <FeedItem key={feed.id} feed={feed} ref={ref} />;
          })}
        {isFetching && <Skeleton />}
      </div>
    </div>
  );
};

export default FeedList;
