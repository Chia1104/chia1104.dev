"use client";

import { Header, ListBox } from "@heroui/react";
import { useTranslations } from "next-intl";

import { useSearchFeeds } from "@/hooks/use-search-feeds";
import { useRouter } from "@/libs/i18n/navigation";
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
      <p role="status" className="text-muted py-6 text-center text-sm">
        {t("search-loading")}
      </p>
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
      <p className="text-muted py-6 text-center text-sm">{t("no-results")}</p>
    );
  }

  return (
    <ListBox
      aria-label={t("articles")}
      className="max-h-[300px] overflow-y-auto">
      <ListBox.Section>
        <Header>{t("articles")}</Header>
        {items.map((feed) => (
          <ListBox.Item
            key={`${feed.locale}-${feed.feedId}`}
            id={`${feed.locale}-${feed.feedId}`}
            textValue={feed.title}
            className="items-start gap-3 px-2 py-2.5 text-sm"
            onAction={() => {
              router.push(`/${feed.type}s/${feed.slug}`, { locale });
              onSelect();
            }}>
            <div className="i-mdi-text-box-search-outline mt-0.5 size-5 shrink-0" />
            <span className="min-w-0">
              <span className="block truncate font-medium">{feed.title}</span>
              <span className="text-muted line-clamp-2 text-xs">
                {feed.description || feed.excerpt}
              </span>
            </span>
          </ListBox.Item>
        ))}
      </ListBox.Section>
    </ListBox>
  );
}
