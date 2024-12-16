"use client";

import type { FC } from "react";

import { useTranslations } from "next-intl";
import Link from "next/link";

import type { RouterOutputs } from "@chia/api";
import { FeedType } from "@chia/db/types";
import {
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuTrigger,
} from "@chia/ui/navigation-menu";
import { cn } from "@chia/ui/utils/cn.util";

import ListItem from "@/components/blog/list-item";
import { useRouter } from "@/i18n/routing";

interface Props {
  feeds?: RouterOutputs["feeds"]["getFeedsWithMetaByAdminId"]["items"];
  type: FeedType;
}

const FeedNavigation: FC<Props> = ({ feeds, type }) => {
  const hasFeeds = !!feeds && Array.isArray(feeds) && feeds.length > 0;
  const router = useRouter();
  const tn = useTranslations("blog.note");
  const tp = useTranslations("blog.post");
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
  return (
    <NavigationMenuItem>
      <NavigationMenuTrigger onClick={() => router.push(getLinkPrefix())}>
        {getTranslations().title}
      </NavigationMenuTrigger>
      <NavigationMenuContent>
        <ul
          className={cn(
            "grid w-[300px] gap-3 p-4 pb-0 md:w-[500px] lg:w-[600px]",
            hasFeeds ? getStyles().ul : "max-w-[300px]"
          )}>
          {hasFeeds ? (
            feeds.map((feed, index) => {
              if (type === FeedType.Post && index === 0) {
                return (
                  <li key={feed.id} className="row-span-3">
                    <NavigationMenuLink asChild>
                      <Link
                        className="from-muted/50 to-muted flex size-full select-none flex-col justify-end rounded-md bg-gradient-to-b p-6 no-underline outline-none focus:shadow-md"
                        href={`${getLinkPrefix()}/${feed.slug}`}>
                        <div className="mb-2 mt-4 line-clamp-2 text-lg font-medium">
                          {feed.title}
                        </div>
                        <p className="text-muted-foreground line-clamp-3 text-sm leading-tight">
                          {feed.description}
                        </p>
                      </Link>
                    </NavigationMenuLink>
                  </li>
                );
              }
              return (
                <ListItem
                  key={feed.id}
                  title={feed.title}
                  href={`${getLinkPrefix()}/${feed.slug}`}>
                  {feed.description}
                </ListItem>
              );
            })
          ) : (
            <ListItem href="">{getTranslations().noContent}</ListItem>
          )}
        </ul>
        <span className="flex w-full items-center justify-end gap-1 py-2 pb-5 pr-5 text-sm font-medium">
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
