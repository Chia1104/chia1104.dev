"use client";

import Link from "next/link";
import type { FC, ReactNode } from "react";

import { Skeleton } from "@heroui/react";
import { useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";

import { FeedOrderBy, FeedType } from "@chia/db/types";
import {
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuTrigger,
} from "@chia/ui/navigation-menu";
import { cn } from "@chia/ui/utils/cn.util";

import ListItem from "@/components/blog/list-item";
import { useRouter } from "@/libs/i18n/navigation";
import { orpc } from "@/libs/orpc/client";
import type { RouterOutputs } from "@/libs/orpc/types";
import { dbLocaleResolver } from "@/libs/utils/i18n";

type ListedFeed = RouterOutputs["feeds"]["list"]["items"][number];

/**
 * Mounted only while its menu is open, so the list is fetched on first open. It stays out of
 * the cached page: every page shows it, and a new post would otherwise make them all stale.
 */
const LatestFeeds = ({
  type,
  children,
}: {
  type: FeedType;
  children: (feeds: ListedFeed[]) => ReactNode;
}) => {
  const locale = useLocale();
  const { data, isPending } = useQuery(
    orpc.feeds.list.queryOptions({
      input: {
        limit: 4,
        withContent: false,
        orderBy: FeedOrderBy.CreatedAt,
        sortOrder: "desc",
        locale: dbLocaleResolver(locale),
        translated: true,
        type,
      },
    })
  );
  if (isPending) {
    return (
      <ul className="grid w-[300px] gap-3 p-4 pb-0 md:w-[500px] lg:w-[600px]">
        {["feed-1", "feed-2", "feed-3"].map((key) => (
          <li key={key}>
            <Skeleton className="h-14 w-full rounded-lg" />
          </li>
        ))}
      </ul>
    );
  }
  return children(data?.items ?? []);
};

interface Props {
  type: FeedType;
}

const FeedNavigation: FC<Props> = ({ type }) => {
  const router = useRouter();
  const tn = useTranslations("blog.notes");
  const tp = useTranslations("blog.posts");
  const getTranslations = () => {
    switch (type) {
      case FeedType.Note:
        return {
          title: tn("doc-title"),
          noContent: tn("no-content"),
          viewAll: tn("view-all"),
        };
      case FeedType.Post:
        return {
          title: tp("doc-title"),
          noContent: tp("no-content"),
          viewAll: tp("view-all"),
        };
      default:
        return {
          title: "Feeds",
          noContent: "No feeds found.",
          viewAll: "View all feeds",
        };
    }
  };
  const getStyles = () => {
    switch (type) {
      case FeedType.Note:
        return {
          ul: "md:grid-cols-2",
        };
      case FeedType.Post:
        return {
          ul: "lg:grid-cols-[.75fr_1fr]",
        };
      default:
        return {
          ul: "",
        };
    }
  };
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
  // The content renders in a popover outside the `page` container, so it sizes by the viewport.
  return (
    <NavigationMenuItem value={type}>
      <NavigationMenuTrigger
        onPress={() => router.push(getLinkPrefix())}
        variant="ghost"
        size="lg">
        {getTranslations().title}
      </NavigationMenuTrigger>
      <NavigationMenuContent>
        <LatestFeeds type={type}>
          {(feeds) => (
            <ul
              className={cn(
                "grid w-[300px] gap-3 p-4 pb-0 md:w-[500px] lg:w-[600px]",
                feeds.length > 0 ? getStyles().ul : "max-w-[300px]"
              )}>
              {feeds.length > 0 ? (
                feeds.map((feed, index) => {
                  if (type === FeedType.Post && index === 0) {
                    return (
                      <li key={feed.id} className="row-span-3">
                        <Link
                          className="from-default/50 to-default text-default-foreground flex size-full flex-col justify-end rounded-2xl bg-linear-to-b p-6 no-underline outline-none select-none focus:shadow-md"
                          href={`${getLinkPrefix()}/${feed.slug}`}>
                          <div className="mt-4 mb-2 line-clamp-2 text-base font-semibold">
                            {feed.translations[0]?.title}
                          </div>
                          <p className="text-muted line-clamp-3 text-sm leading-snug">
                            {feed.translations[0]?.description}
                          </p>
                        </Link>
                      </li>
                    );
                  }
                  return (
                    <ListItem
                      key={feed.id}
                      title={feed.translations[0]?.title}
                      href={`${getLinkPrefix()}/${feed.slug}`}>
                      {feed.translations[0]?.description}
                    </ListItem>
                  );
                })
              ) : (
                <ListItem href="">{getTranslations().noContent}</ListItem>
              )}
            </ul>
          )}
        </LatestFeeds>
        <span className="flex w-full items-center justify-end gap-1 py-2 pr-5 pb-5 text-sm font-medium">
          <Link href={getLinkPrefix()} className="w-fit">
            {getTranslations().viewAll}
          </Link>
          <span className="i-lucide-chevron-right size-3" />
        </span>
      </NavigationMenuContent>
    </NavigationMenuItem>
  );
};

export default FeedNavigation;
