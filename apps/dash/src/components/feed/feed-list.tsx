"use client";

import { useTransitionRouter as useRouter } from "next-view-transitions";
import type { FC } from "react";
import { forwardRef, useMemo, memo, useState } from "react";

import { Card, CardBody, CardHeader, Chip, Button } from "@heroui/react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { Pencil, Trash } from "lucide-react";

import { FeedOrderBy, FeedType } from "@chia/db/types";
import CHCard from "@chia/ui/card";
import DateFormat from "@chia/ui/date-format";
import Image from "@chia/ui/image";
import useInfiniteScroll from "@chia/ui/utils/use-infinite-scroll";
import dayjs from "@chia/utils/day";

import { useGetAllDrafts } from "@/hooks/use-draft";
import { orpc } from "@/libs/orpc/client";
import type { RouterInputs, RouterOutputs } from "@/libs/orpc/types";

import Skeleton from "./skeleton";

interface Props {
  initFeed?: RouterOutputs["feeds"]["list"]["items"];
  nextCursor?: string | number | null;
  useClient?: boolean;
  query?: RouterInputs["feeds"]["list"];
}

const Empty = () => {
  return (
    <CHCard
      className="prose dark:prose-invert flex w-full max-w-full flex-col items-center justify-center gap-5 px-1 py-12 sm:px-4"
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
    feed: RouterOutputs["feeds"]["list"]["items"][0];
  }
>(({ feed }, ref) => {
  const router = useRouter();
  // Get first translation (default locale)
  const translation = feed.translations?.[0];
  const title = translation?.title ?? "Untitled";
  const excerpt = translation?.excerpt ?? "";

  return (
    <Card ref={ref} className="dark:bg-dark/90 grid-cols-1">
      <CardHeader>
        <h4
          className="line-clamp-2 text-xl font-medium"
          style={{
            viewTransitionName: `view-transition-link-${feed.id}`,
          }}>
          {title}
        </h4>
      </CardHeader>
      <CardBody className="gap-2">
        <p className="mt-auto line-clamp-2 text-xs font-bold">{excerpt}</p>
        <span className="flex items-center justify-between text-xs font-bold">
          <DateFormat date={feed.createdAt} format="MMMM D, YYYY" />
          <span className="flex items-center gap-2">
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
  feed: Partial<{
    translation?: {
      title?: string;
      description?: string | null;
    };
    createdAt?: string | number;
    updatedAt?: string | number;
  }>;
  token: string;
  onRemove?: () => void;
}) => {
  const router = useRouter();
  const title = feed.translation?.title ?? "Untitled";
  const description = feed.translation?.description ?? "";

  return (
    <Card className="dark:bg-dark/90 grid-cols-1">
      <CardHeader>
        <h4
          className="line-clamp-2 text-xl font-medium"
          style={{
            viewTransitionName: `view-transition-link-${token}`,
          }}>
          {title}
        </h4>
      </CardHeader>
      <CardBody className="gap-2">
        <p className="mt-auto line-clamp-2 text-xs font-bold">{description}</p>
        <span className="flex items-center justify-between text-sm font-bold">
          <DateFormat date={feed.createdAt} format="MMMM D, YYYY" />
          <span className="flex items-center gap-2">
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
  } = useInfiniteQuery(
    orpc.feeds.list.infiniteOptions({
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
      initialData: initFeed
        ? {
            pages: [
              {
                items: initFeed,
                nextCursor: nextCursor?.toString() ?? null,
              },
            ],
            pageParams: [nextCursor?.toString() ?? null],
          }
        : undefined,
      initialPageParam: nextCursor?.toString() ?? null,
    })
  );

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
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
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
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
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
