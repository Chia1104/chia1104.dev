"use client";

import { type FC, forwardRef, useMemo } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { type Post } from "db";
import { api } from "trpc-api";
import { useInfiniteScroll } from "ui";

interface Props {
  initFeed?: Post[];
  useClient?: boolean;
}

const FeedItem = forwardRef<HTMLDivElement, { post: Post }>(({ post }, ref) => {
  return <div ref={ref}>{post.title}</div>;
});
FeedItem.displayName = "FeedItem";

const FeedList: FC<Props> = (props) => {
  const { initFeed } = props;
  const { data, isSuccess, isLoading, fetchNextPage, hasNextPage } =
    useInfiniteQuery({
      queryKey: ["posts"],
      queryFn: ({ pageParam }) =>
        api.post.infinite.query({ limit: 5, cursor: pageParam }),
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
              nextCursor: initFeed[initFeed.length - 1].id,
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
    isLoading,
    onLoadMore: fetchNextPage,
    intersectionObserverInit: {
      rootMargin: "0px 0px 200px 0px",
    },
  });
  return (
    <div>
      <h1>FeedList</h1>
      {isSuccess &&
        flatData?.map((post) => {
          return <FeedItem key={post.id} post={post} ref={ref} />;
        })}
    </div>
  );
};

export default FeedList;
