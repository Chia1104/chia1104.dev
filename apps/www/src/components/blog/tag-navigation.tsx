"use client";

import type { FC } from "react";
import { use } from "react";

import { useTranslations } from "next-intl";

import type { Locale } from "@chia/db/types";
import {
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuTrigger,
} from "@chia/ui/navigation-menu";
import { cn } from "@chia/ui/utils/cn.util";

import ListItem from "@/components/blog/list-item";
import { Link, useRouter } from "@/libs/i18n/navigation";
import type { RouterOutputs } from "@/libs/orpc/types";

interface Props {
  tags: Promise<RouterOutputs["tags"]["list"]>;
  locale: Locale;
}

/** Only tags with a published post; the count comes from the same read. */
const TagNavigation: FC<Props> = ({ tags: promisedTags, locale }) => {
  const tags = use(promisedTags).items.filter((tag) => tag.feedCount > 0);
  const hasTags = tags.length > 0;
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
        <ul
          className={cn(
            "grid w-[300px] gap-3 p-4 pb-0 md:w-[500px]",
            hasTags ? "md:grid-cols-2" : "max-w-[300px]"
          )}>
          {hasTags ? (
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
