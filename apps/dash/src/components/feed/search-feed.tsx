"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState, useTransition } from "react";

import { Button, Spinner, ButtonGroup, ScrollShadow } from "@heroui/react";
import { useDebouncedCallback } from "@tanstack/react-pacer";
import { Search } from "lucide-react";

import { Locale } from "@chia/db/types";
import {
  CommandDialog,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
  CommandLoading,
} from "@chia/ui/cmd";
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

/** All modes return the same row shape, so this is one mapping. */
const normaliseHits = (
  result: ReturnType<typeof useSearchFeeds>["data"]
): NormalisedHit[] =>
  result?.items.map((hit) => ({
    feedId: hit.feedId,
    title: hit.summary.title,
    excerpt:
      stripHighlight(hit.bestChunk.snippet) || hit.summary.description || "",
  })) ?? [];

const SearchForm = ({ isOpen, onOpenChange }: SearchFormProps) => {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [locale, setLocale] = useState<Locale>(Locale.zhTW);
  const [model, setModel] = useState<"hybrid" | "bm25" | "semantic">("hybrid");

  /**
   * `hybrid` is the default: a document-level vector alone under-recalls exact
   * terms (package names, CLI flags, error messages), which is what BM25 is
   * there to catch. The other two isolate one half for comparison.
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
      open={isOpen}
      onOpenChange={handleOpenChange}
      commandProps={{
        shouldFilter: false,
      }}>
      <CommandInput
        placeholder="Search Feeds"
        name="query"
        classNames={{
          wrapper: ["w-full border-none"],
        }}
        onValueChange={(value) => handleSearch(value)}
      />
      <CommandList>
        <div className="flex items-center justify-start gap-4 px-4 pb-4">
          <ButtonGroup size="sm" variant="outline">
            <Button
              className="h-5.5"
              onPress={() => setLocale(Locale.En)}
              variant={locale === Locale.En ? "primary" : "outline"}>
              EN
            </Button>
            <Button
              className="h-5.5"
              onPress={() => setLocale(Locale.zhTW)}
              variant={locale === Locale.zhTW ? "primary" : "outline"}>
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
        {isSearching && (
          <CommandLoading className="flex w-full justify-center py-10">
            <Spinner />
          </CommandLoading>
        )}
        {feeds?.items.length === 0 && (
          <CommandEmpty>No results found.</CommandEmpty>
        )}
        {normaliseHits(feeds).map((hit) => (
          <CommandItem
            key={`${hit.feedId}-${hit.title}`}
            onSelect={() => handleSelect(hit.feedId)}
            disabled={isPending}>
            <div className="flex flex-col gap-2">
              <p className="text-sm font-medium">{hit.title}</p>
              {hit.excerpt && (
                <p className="text-muted-foreground line-clamp-2 text-xs">
                  {hit.excerpt}
                </p>
              )}
            </div>
          </CommandItem>
        ))}
      </CommandList>
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
