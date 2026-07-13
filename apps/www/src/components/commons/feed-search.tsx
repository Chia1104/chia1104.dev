"use client";

import { useTranslations } from "next-intl";

import { CommandGroup, CommandItem, CommandLoading } from "@chia/ui/cmd";

import { useSearchFeeds } from "@/hooks/use-search-feeds";
import { useRouter } from "@/libs/i18n/routing";
import { dbLocaleResolver } from "@/libs/utils/i18n";

interface FeedSearchProps {
  query: string;
  locale: PropsWithLocale["locale"];
  onSelect: () => void;
}

export function FeedSearch({ query, locale, onSelect }: FeedSearchProps) {
  const router = useRouter();
  const t = useTranslations("nav");
  const search = useSearchFeeds(query, dbLocaleResolver(locale));
  const isDebouncing = query.trim() !== search.debouncedKeyword;

  if (query.trim().length < 2) {
    return null;
  }

  if (isDebouncing || search.isPending || search.isFetching) {
    return (
      <CommandLoading className="text-muted-foreground py-6 text-center text-sm">
        {t("search-loading")}
      </CommandLoading>
    );
  }

  if (search.isError) {
    return (
      <p role="alert" className="text-danger py-6 text-center text-sm">
        {t("search-error")}
      </p>
    );
  }

  const items = search.data?.items ?? [];
  if (items.length === 0) {
    return (
      <p className="text-muted-foreground py-6 text-center text-sm">
        {t("no-results")}
      </p>
    );
  }

  return (
    <CommandGroup heading={t("articles")}>
      {items.map((feed) => (
        <CommandItem
          key={`${feed.locale}-${feed.feedId}`}
          value={`${feed.title} ${feed.description}`}
          className="items-start gap-3"
          onSelect={() => {
            router.push(`/${feed.type}s/${feed.slug}`, { locale });
            onSelect();
          }}>
          <div className="i-mdi-text-box-search-outline mt-0.5 size-5 shrink-0" />
          <span className="min-w-0">
            <span className="block truncate font-medium">{feed.title}</span>
            <span className="text-muted-foreground line-clamp-2 text-xs">
              {feed.description || feed.excerpt}
            </span>
          </span>
        </CommandItem>
      ))}
    </CommandGroup>
  );
}
