"use client";

import { forwardRef, useMemo, memo, useState } from "react";
import type { FC } from "react";

import { Card, CardBody, CardHeader, Chip, Button } from "@nextui-org/react";
import dayjs from "dayjs";
import { Pencil, Trash } from "lucide-react";
import { useRouter } from "next/navigation";

import type { RouterInputs, RouterOutputs } from "@chia/api";
import { FeedType } from "@chia/db/types";
import { useInfiniteScroll, Image, Card as CHCard } from "@chia/ui";

import { useGetAllDrafts } from "@/app/(main)/feed/(edit)/_components/use-draft";
import { api } from "@/trpc/client";

import Skeleton from "./skeleton";

interface Props {
  initFeed?: RouterOutputs["feeds"]["getFeedsWithMeta"]["items"];
  nextCursor?: string | number | null;
  useClient?: boolean;
  query?: RouterInputs["feeds"]["getFeedsWithMeta"];
}

const Empty = () => {
  return (
    <CHCard
      className="prose dark:prose-invert flex w-full flex-col items-center justify-center px-1 py-12 sm:px-4 gap-5 max-w-full"
      wrapperProps={{
        className: "w-full",
      }}>
      <h3>Currently no feeds available</h3>
      <Image
        src="/img-empty.png"
        alt="Empty"
        width={150}
        height={150}
        blur={false}
      />
    </CHCard>
  );
};

const FeedItem = forwardRef<
  HTMLDivElement,
  {
    feed: RouterOutputs["feeds"]["getFeedsWithMeta"]["items"][0];
  }
>(({ feed }, ref) => {
  const router = useRouter();
  return (
    <Card ref={ref} className="dark:bg-dark/90 grid-cols-1">
      <CardHeader>
        <h4
          className="font-medium text-large line-clamp-2"
          style={{
            viewTransitionName: `view-transition-link-${feed.id}`,
          }}>
          {feed.title}
        </h4>
      </CardHeader>
      <CardBody className="gap-2">
        <p className="text-tiny font-bold mt-auto line-clamp-2">
          {feed.excerpt}
        </p>
        <span className="text-tiny font-bold flex justify-between items-center">
          {dayjs(feed.createdAt).format("MMMM D, YYYY")}
          <span className="flex gap-2 items-center">
            <Button
              variant="shadow"
              size="sm"
              isIconOnly
              onPress={() =>
                router.push(
                  feed.type === FeedType.Post
                    ? `/feed/edit/${feed.id}?type=post`
                    : `/feed/edit/${feed.id}?type=note`
                )
              }>
              <Pencil size={14} />
            </Button>
            <Chip
              variant="shadow"
              color={feed.published ? "success" : "default"}>
              {feed.published ? "Published" : "Unpublished"}
            </Chip>
          </span>
        </span>
      </CardBody>
    </Card>
  );
});
FeedItem.displayName = "FeedItem";

export const PreviewFeedItem = ({
  feed,
  token,
  onRemove,
}: {
  feed: Partial<RouterOutputs["feeds"]["getFeedsWithMeta"]["items"][0]>;
  token: string;
  onRemove?: () => void;
}) => {
  const router = useRouter();
  return (
    <Card className="dark:bg-dark/90 grid-cols-1">
      <CardHeader>
        <h4
          className="font-medium text-large line-clamp-2"
          style={{
            viewTransitionName: `view-transition-link-${token}`,
          }}>
          {feed.title}
        </h4>
      </CardHeader>
      <CardBody className="gap-2">
        <p className="text-tiny font-bold mt-auto line-clamp-2">
          {feed.description}
        </p>
        <span className="text-tiny font-bold flex justify-between items-center">
          {dayjs(feed.createdAt).format("MMMM D, YYYY")}
          <span className="flex gap-2 items-center">
            <Button
              variant="shadow"
              size="sm"
              isIconOnly
              onPress={() => router.push(`/feed/write?token=${token}`)}>
              <Pencil size={14} />
            </Button>
            <Button variant="shadow" size="sm" isIconOnly onPress={onRemove}>
              <Trash size={14} />
            </Button>
          </span>
        </span>
      </CardBody>
    </Card>
  );
};

const FeedList: FC<Props> = (props) => {
  const { initFeed, nextCursor, query = {} } = props;
  const {
    data,
    isSuccess,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
  } = api.feeds.getFeedsWithMeta.useInfiniteQuery(query, {
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
      {isSuccess && flatData.length === 0 && <Empty />}
      <div className="grid gap-5 grid-cols-1 md:grid-cols-2">
        {isSuccess &&
          !!flatData &&
          flatData.map((feed, index) => {
            if (flatData.length === index + 1) {
              return <FeedItem key={feed.id} ref={ref} feed={feed} />;
            }
            return <FeedItem key={feed.id} feed={feed} />;
          })}
        {(isFetchingNextPage || isLoading) && <Skeleton />}
      </div>
    </div>
  );
};

export const Drafts = () => {
  const [now, setNow] = useState(dayjs().valueOf().toString());
  const drafts = useGetAllDrafts(now);
  if (drafts.length === 0) {
    return <Empty />;
  }
  return (
    <div className="w-full">
      <div className="grid gap-5 grid-cols-1 md:grid-cols-2">
        {drafts.map((draft, i) =>
          draft?.state?.draft ? (
            <PreviewFeedItem
              key={i}
              feed={{
                ...draft.state.draft,
                createdAt: dayjs(draft.state.draft.createdAt).toISOString(),
                updatedAt: dayjs(draft.state.draft.updatedAt).toISOString(),
              }}
              token={draft.state.token}
              onRemove={() => {
                localStorage.removeItem(`CONTENT_DRAFT_${draft.state.token}`);
                setNow(dayjs().valueOf().toString());
              }}
            />
          ) : null
        )}
      </div>
    </div>
  );
};

export default memo(FeedList, (prev, next) => {
  return prev.initFeed === next.initFeed;
});
