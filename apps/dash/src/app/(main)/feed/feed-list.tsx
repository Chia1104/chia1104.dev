"use client";

import { type FC, forwardRef, useMemo } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { type Post } from "@chia/db";
import { api } from "trpc-api";
import { useInfiniteScroll } from "@chia/ui";
import { Card, CardBody } from "@nextui-org/react";
import { RouterInputs } from "@chia/api";
import Skeleton from "./skeleton";

interface Props {
  initFeed?: Post[];
  nextCursor?: string | number;
  useClient?: boolean;
  query?: RouterInputs["post"]["infinite"];
}

const FeedItem = forwardRef<HTMLDivElement, { post: Post }>(({ post }, ref) => {
  return (
    <Card ref={ref} className="dark:bg-dark/90">
      <CardBody>{post.title}</CardBody>
    </Card>
  );
});
FeedItem.displayName = "FeedItem";

const FeedList: FC<Props> = (props) => {
  const { initFeed, nextCursor, query } = props;
  const { data, isSuccess, isFetching, fetchNextPage, hasNextPage } =
    useInfiniteQuery({
      queryKey: ["posts"],
      queryFn: ({ pageParam }) =>
        api.post.infinite.query({ ...query, cursor: pageParam }),
      getNextPageParam: (lastPage) => {
        if (lastPage.hasNextPage) {
          return lastPage.nextCursor;
        }
        return undefined;
      },
      initialData: () => {
        if (!initFeed) return undefined;
        return {
          pages: [
            {
              items: initFeed,
              hasNextPage: true,
              nextCursor: nextCursor,
            },
          ],
          pageParams: [undefined],
        };
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
          flatData?.map((post) => {
            return <FeedItem key={post.id} post={post} ref={ref} />;
          })}
        {isFetching && <Skeleton />}
      </div>
    </div>
  );
};

export default FeedList;
