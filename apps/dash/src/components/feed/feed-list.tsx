"use client";

import { useRouter } from "next/navigation";
import { forwardRef, useMemo, memo, useCallback } from "react";

import { Card, Button, Chip, Tooltip } from "@heroui/react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { Pencil } from "lucide-react";

import { FeedType } from "@chia/db/types";
import CHCard from "@chia/ui/card";
import DateFormat from "@chia/ui/date-format";
import useInfiniteScroll from "@chia/ui/utils/use-infinite-scroll";
import dayjs from "@chia/utils/day";

import { orpc } from "@/libs/orpc/client";
import type { RouterInputs, RouterOutputs } from "@/libs/orpc/types";

import { Logo } from "../commons/logo";

import { MetaChip } from "./meta-chip";
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

const SUPPORTED_LOCALES_META = [
  { key: "zh-TW", label: "中文" },
  { key: "en", label: "EN" },
] as const;

const FeedItem = memo(
  forwardRef<
    HTMLDivElement,
    {
      feed: RouterOutputs["feeds"]["list"]["items"][0];
    }
  >(({ feed }, ref) => {
    const router = useRouter();

    const translationsByLocale = useMemo(
      () =>
        Object.fromEntries((feed.translations ?? []).map((t) => [t.locale, t])),
      [feed.translations]
    );

    const defaultTranslation =
      translationsByLocale[feed.defaultLocale ?? "zh-TW"] ??
      feed.translations?.[0];
    const title = defaultTranslation?.title ?? "Untitled";

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
          <Tooltip isDisabled={title.length <= 50} delay={400}>
            <Tooltip.Trigger>
              <Card.Title
                className="line-clamp-2 cursor-default text-xl"
                style={{
                  viewTransitionName: `view-transition-link-${feed.id}`,
                }}>
                {title}
              </Card.Title>
            </Tooltip.Trigger>
            <Tooltip.Content showArrow>
              <Tooltip.Arrow />
              <p className="max-w-xs text-sm">{title}</p>
            </Tooltip.Content>
          </Tooltip>
        </Card.Header>
        <Card.Content>
          <div className="flex flex-col gap-1.5 rounded-lg border border-dashed p-2.5">
            {SUPPORTED_LOCALES_META.map(({ key, label }) => {
              const t = translationsByLocale[key];
              const isDefault = key === feed.defaultLocale;
              const translationTitle = t?.title ?? "";
              return (
                <div key={key} className="flex items-center gap-2">
                  <Chip
                    variant="soft"
                    color={isDefault ? "accent" : "default"}
                    size="sm"
                    className="w-9 shrink-0 justify-center font-mono text-[10px]">
                    {label}
                  </Chip>
                  {t ? (
                    <Tooltip
                      isDisabled={translationTitle.length <= 40}
                      delay={400}>
                      <Tooltip.Trigger className="line-clamp-1 min-w-0 flex-1 text-xs">
                        {translationTitle}
                      </Tooltip.Trigger>
                      <Tooltip.Content showArrow>
                        <Tooltip.Arrow />
                        <p className="max-w-xs text-xs">{translationTitle}</p>
                      </Tooltip.Content>
                    </Tooltip>
                  ) : (
                    <span className="text-muted-foreground flex-1 text-xs italic">
                      — Not translated
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </Card.Content>
        <Card.Footer className="mt-auto flex items-center justify-between text-xs font-bold">
          <DateFormat date={feed.createdAt} format="MMMM D, YYYY" />
          <span className="flex items-center gap-2">
            <MetaChip
              embedding={Object.fromEntries(
                feed.translations.map((translation) => [
                  translation.locale,
                  translation.hasEmbedding,
                ])
              )}
              published={feed.published}
              deleted={
                feed.deletedAt ? dayjs(feed.deletedAt).toISOString() : null
              }
            />
            <Button variant="outline" size="sm" onPress={handleEdit}>
              <Pencil className="size-3.5" />
              <span className="text-xs">Edit</span>
            </Button>
          </span>
        </Card.Footer>
      </Card>
    );
  })
);

FeedItem.displayName = "FeedItem";

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
        // The management view is the whole set: `feeds.list` defaults to the published,
        // non-deleted slice it serves the public site with.
        includeUnpublished: true,
        includeDeleted: true,
        ...query,
        nextCursor: pageParam ?? undefined,
      }),
      getNextPageParam: (lastPage: RouterOutputs["feeds"]["list"]) => {
        if (!lastPage.nextCursor) return null;
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

export default memo(FeedList, (prev, next) => {
  return prev.initFeed === next.initFeed && prev.query === next.query;
});
