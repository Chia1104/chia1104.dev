"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState, useTransition } from "react";

import {
  Button,
  Spinner,
  ButtonGroup,
  ListBox,
  ScrollShadow,
} from "@heroui/react";
import { useDebouncedCallback } from "@tanstack/react-pacer";
import { Search } from "lucide-react";

import { Locale } from "@chia/db/types";
import { CommandDialog, CommandInput } from "@chia/ui/cmd";
import { cn } from "@chia/ui/utils/cn.util";

import { useSearchFeeds } from "@/hooks/use-search-feeds";

interface SearchFormProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

/** Result rows differ per provider; the list only needs id + title + preview. */
interface NormalisedHit {
  feedId: number;
  title: string;
  excerpt: string;
}

const stripHighlight = (value: string | null | undefined) =>
  value?.replaceAll(/<\/?b>/g, "") ?? "";

const normaliseHits = (
  result: ReturnType<typeof useSearchFeeds>["data"]
): NormalisedHit[] =>
  result?.items.map((hit) => ({
    feedId: hit.feedId,
    title: hit.summary.title,
    excerpt:
      stripHighlight(hit.chunks[0]?.snippet) || hit.summary.description || "",
  })) ?? [];

const SearchForm = ({ isOpen, onOpenChange }: SearchFormProps) => {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [locale, setLocale] = useState<Locale>(Locale.ZhTW);
  const [model, setModel] = useState<"hybrid" | "bm25" | "semantic">("hybrid");

  /**
   * `hybrid` is the default: a document-level vector alone under-recalls exact terms
   * (package names, CLI flags, error messages), which is what BM25 catches.
   */
  const supportedModels = ["hybrid", "bm25", "semantic"] as const;

  const {
    mutate: searchFeeds,
    data: feeds,
    isPending: isSearching,
    reset: resetSearch,
  } = useSearchFeeds();

  const handleSearch = useDebouncedCallback(
    (query: string) => {
      if (!query) return;
      searchFeeds({ keyword: query, locale, model });
    },
    {
      wait: 750,
    }
  );

  const handleSelect = useCallback(
    (feedId: string | number) => {
      onOpenChange(false);
      startTransition(() => {
        router.push(`/feed/edit/${feedId}`);
      });
    },
    [router, onOpenChange]
  );

  const handleOpenChange = useCallback(
    (open: boolean) => {
      onOpenChange(open);
      if (!open) {
        resetSearch();
      }
    },
    [resetSearch, onOpenChange]
  );

  return (
    <CommandDialog
      aria-label="Search Feeds"
      isOpen={isOpen}
      onOpenChange={handleOpenChange}
      onInputChange={(value) => handleSearch(value)}>
      <CommandInput placeholder="Search Feeds" />
      <div className="flex items-center justify-start gap-4 p-4">
        <ButtonGroup size="sm" variant="outline">
          <Button
            className="h-5.5"
            onPress={() => setLocale(Locale.En)}
            variant={locale === Locale.En ? "primary" : "outline"}>
            EN
          </Button>
          <Button
            className="h-5.5"
            onPress={() => setLocale(Locale.ZhTW)}
            variant={locale === Locale.ZhTW ? "primary" : "outline"}>
            <ButtonGroup.Separator />
            中文
          </Button>
        </ButtonGroup>
        <ScrollShadow
          className="flex w-full items-center gap-1.5 px-4"
          hideScrollBar
          orientation="horizontal">
          {supportedModels.map((m) => (
            <Button
              className="h-5.5"
              size="sm"
              key={m}
              onPress={() => setModel(m)}
              variant={m === model ? "primary" : "outline"}>
              {m}
            </Button>
          ))}
        </ScrollShadow>
      </div>
      {isSearching ? (
        <div role="status" className="flex w-full justify-center py-10">
          <Spinner />
        </div>
      ) : (
        <ListBox
          aria-label="Feeds"
          className="max-h-[300px] overflow-y-auto p-1"
          renderEmptyState={() =>
            feeds ? (
              <p className="py-6 text-center text-sm">No results found.</p>
            ) : null
          }>
          {normaliseHits(feeds).map((hit) => (
            <ListBox.Item
              key={`${hit.feedId}-${hit.title}`}
              id={`${hit.feedId}-${hit.title}`}
              textValue={hit.title}
              onAction={() => handleSelect(hit.feedId)}
              isDisabled={isPending}>
              <div className="flex flex-col gap-2">
                <p className="text-sm font-medium">{hit.title}</p>
                {hit.excerpt && (
                  <p className="text-muted line-clamp-2 text-xs">
                    {hit.excerpt}
                  </p>
                )}
              </div>
            </ListBox.Item>
          ))}
        </ListBox>
      )}
    </CommandDialog>
  );
};

interface SearchFeedProps {
  className?: string;
}

const SearchFeed = ({ className }: SearchFeedProps) => {
  const [isOpen, setIsOpen] = useState(false);

  const handleOpen = useCallback(() => {
    setIsOpen(true);
  }, []);

  const handleOpenChange = useCallback((open: boolean) => {
    setIsOpen(open);
  }, []);

  return (
    <>
      <Button
        variant="outline"
        onPress={handleOpen}
        className={cn("gap-2", className)}>
        <Search className="size-4" />
        <span>Search Feeds</span>
      </Button>
      <SearchForm isOpen={isOpen} onOpenChange={handleOpenChange} />
    </>
  );
};

export default SearchFeed;
