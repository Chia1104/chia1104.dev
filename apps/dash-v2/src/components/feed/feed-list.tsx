"use client";

import { useRouter } from "next/navigation";
import { forwardRef, useMemo, memo, useState, useCallback } from "react";

import { Card, Button, Chip } from "@heroui/react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { Pencil, Trash } from "lucide-react";
import { useShallow } from "zustand/react/shallow";

import { FeedOrderBy, FeedType } from "@chia/db/types";
import CHCard from "@chia/ui/card";
import DateFormat from "@chia/ui/date-format";
import useInfiniteScroll from "@chia/ui/utils/use-infinite-scroll";
import dayjs from "@chia/utils/day";

import { orpc } from "@/libs/orpc/client";
import type { RouterInputs, RouterOutputs } from "@/libs/orpc/types";
import { useAllDrafts, useDraftStore } from "@/store/draft";

import { Logo } from "../commons/logo";

import FeedSkeleton from "./skeleton";

interface Props {
  initFeed?: RouterOutputs["feeds"]["list"]["items"];
  nextCursor?: string | number | null;
  query?: RouterInputs["feeds"]["list"];
}

const Empty = memo(() => {
  return (
    <CHCard
      className="prose dark:prose-invert flex w-full max-w-full flex-col items-center justify-center gap-5 px-1 py-12 sm:px-4"
      wrapperProps={{
        className: "w-full",
      }}>
      <h3>Currently no feeds available</h3>
      <div className="not-prose">
        <Logo classNames={{ root: "size-20" }} />
      </div>
    </CHCard>
  );
});

Empty.displayName = "Empty";

const FeedItem = memo(
  forwardRef<
    HTMLDivElement,
    {
      feed: RouterOutputs["feeds"]["list"]["items"][0];
    }
  >(({ feed }, ref) => {
    const router = useRouter();

    const translation = feed.translations?.[0];
    const title = translation?.title ?? "Untitled";
    const excerpt = translation?.excerpt ?? "";

    const handleEdit = useCallback(() => {
      const editPath =
        feed.type === FeedType.Post
          ? `/feed/edit/${feed.id}?type=post`
          : `/feed/edit/${feed.id}?type=note`;
      router.push(editPath);
    }, [feed.id, feed.type, router]);

    return (
      <Card ref={ref}>
        <Card.Header>
          <Card.Title
            className="line-clamp-2 text-xl"
            style={{
              viewTransitionName: `view-transition-link-${feed.id}`,
            }}>
            {title}
          </Card.Title>
        </Card.Header>
        <Card.Content className="gap-2">
          <p className="mt-auto line-clamp-2 text-xs font-bold">{excerpt}</p>
          <span className="flex items-center justify-between text-xs font-bold">
            <DateFormat date={feed.createdAt} format="MMMM D, YYYY" />
            <span className="flex items-center gap-2">
              <Button variant="outline" size="sm" onPress={handleEdit}>
                <Pencil className="size-4" />
                <span className="text-xs">Edit</span>
              </Button>
              <Chip
                variant={feed.published ? "primary" : "secondary"}
                color={feed.published ? "success" : "default"}>
                {feed.published ? "Published" : "Unpublished"}
              </Chip>
            </span>
          </span>
        </Card.Content>
      </Card>
    );
  })
);

FeedItem.displayName = "FeedItem";

export const PreviewFeedItem = memo(
  ({
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

    const handleEdit = useCallback(() => {
      router.push(`/feed/create?token=${token}`);
    }, [router, token]);

    return (
      <Card>
        <Card.Header>
          <Card.Title
            className="line-clamp-2 text-xl"
            style={{
              viewTransitionName: `view-transition-link-${token}`,
            }}>
            {title}
          </Card.Title>
        </Card.Header>
        <Card.Content className="gap-2">
          <p className="mt-auto line-clamp-2 text-xs font-bold">
            {description}
          </p>
          <span className="flex items-center justify-between text-sm font-bold">
            <DateFormat date={feed.createdAt} format="MMMM D, YYYY" />
            <span className="flex items-center gap-2">
              <Button variant="outline" size="sm" onPress={handleEdit}>
                <Pencil className="size-4" />
                <span className="text-xs">Edit</span>
              </Button>
              <Button variant="danger" size="sm" onPress={onRemove}>
                <Trash className="size-4" />
                <span className="text-xs">Delete</span>
              </Button>
            </span>
          </span>
        </Card.Content>
      </Card>
    );
  }
);

PreviewFeedItem.displayName = "PreviewFeedItem";

const FeedList = ({ initFeed, nextCursor, query = {} }: Props) => {
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
      getNextPageParam: (lastPage: RouterOutputs["feeds"]["list"]) => {
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
      {isSuccess && flatData.length === 0 ? <Empty /> : null}
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        {isSuccess && flatData.length > 0
          ? flatData.map((feed, index) => {
              const isLastItem = flatData.length === index + 1;
              return (
                <FeedItem
                  key={feed.id}
                  ref={isLastItem ? ref : undefined}
                  feed={feed}
                />
              );
            })
          : null}
        {isFetchingNextPage || isLoading ? <FeedSkeleton /> : null}
      </div>
    </div>
  );
};

export const Drafts = () => {
  const [refreshKey, setRefreshKey] = useState(0);
  const router = useRouter();
  const drafts = useAllDrafts();
  const deleteDraft = useDraftStore(useShallow((state) => state.deleteDraft));

  const handleRemove = useCallback(
    (token: string) => {
      deleteDraft(token);
      setRefreshKey((prev) => prev + 1);
      router.refresh();
    },
    [deleteDraft, router]
  );

  if (drafts.length === 0) {
    return <Empty />;
  }

  return (
    <div className="w-full">
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        {drafts.map((draft) =>
          draft?.formData ? (
            <PreviewFeedItem
              key={`${draft.token}-${refreshKey}`}
              feed={{
                ...draft.formData,
                createdAt: draft.formData.createdAt
                  ? dayjs(draft.formData.createdAt).toISOString()
                  : undefined,
                updatedAt: draft.formData.updatedAt
                  ? dayjs(draft.formData.updatedAt).toISOString()
                  : undefined,
              }}
              token={draft.token}
              onRemove={() => handleRemove(draft.token)}
            />
          ) : null
        )}
      </div>
    </div>
  );
};

export default memo(FeedList, (prev, next) => {
  return prev.initFeed === next.initFeed && prev.query === next.query;
});
