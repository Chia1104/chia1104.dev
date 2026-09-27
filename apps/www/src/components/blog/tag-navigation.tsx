"use client";

import type { ReactNode } from "react";

import { Skeleton } from "@heroui/react";
import { useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";

import {
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuTrigger,
} from "@chia/ui/navigation-menu";
import { cn } from "@chia/ui/utils/cn.util";

import ListItem from "@/components/blog/list-item";
import { Link, useRouter } from "@/libs/i18n/navigation";
import { orpc } from "@/libs/orpc/client";
import type { RouterOutputs } from "@/libs/orpc/types";
import { dbLocaleResolver } from "@/libs/utils/i18n";

type ListedTag = RouterOutputs["tags"]["list"]["items"][number];

/**
 * Mounted only while the menu is open, so the tags are fetched on first open and stay out of
 * every cached page. Only tags with a published post; the count comes from the same read.
 */
const PublishedTags = ({
  children,
}: {
  children: (tags: ListedTag[]) => ReactNode;
}) => {
  const { data, isPending } = useQuery(orpc.tags.list.queryOptions());
  if (isPending) {
    return (
      <ul className="grid w-[300px] gap-3 p-4 pb-0 md:w-[500px] md:grid-cols-2">
        {["tag-1", "tag-2", "tag-3", "tag-4"].map((key) => (
          <li key={key}>
            <Skeleton className="h-12 w-full rounded-lg" />
          </li>
        ))}
      </ul>
    );
  }
  return children((data?.items ?? []).filter((tag) => tag.feedCount > 0));
};

const TagNavigation = () => {
  const locale = dbLocaleResolver(useLocale());
  const router = useRouter();
  const t = useTranslations("blog.tags");

  // The content renders in a popover outside the `page` container, so it sizes by the viewport.
  return (
    <NavigationMenuItem value="tags">
      <NavigationMenuTrigger
        onPress={() => router.push("/tags")}
        variant="ghost"
        size="lg">
        {t("doc-title")}
      </NavigationMenuTrigger>
      <NavigationMenuContent>
        <PublishedTags>
          {(tags) => (
            <ul
              className={cn(
                "grid w-[300px] gap-3 p-4 pb-0 md:w-[500px]",
                tags.length > 0 ? "md:grid-cols-2" : "max-w-[300px]"
              )}>
              {tags.length > 0 ? (
                tags.map((tag) => (
                  <ListItem
                    key={tag.id}
                    title={tag.translations[locale]?.name ?? tag.slug}
                    href={`/tags/${tag.slug}`}>
                    {[
                      t("count", { count: tag.feedCount }),
                      tag.translations[locale]?.description,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </ListItem>
                ))
              ) : (
                <ListItem href="">{t("no-content")}</ListItem>
              )}
            </ul>
          )}
        </PublishedTags>
        <span className="flex w-full items-center justify-end gap-1 py-2 pr-5 pb-5 text-sm font-medium">
          <Link href="/tags" className="w-fit">
            {t("view-all")}
          </Link>
          <span className="i-lucide-chevron-right size-3" />
        </span>
      </NavigationMenuContent>
    </NavigationMenuItem>
  );
};

export default TagNavigation;
