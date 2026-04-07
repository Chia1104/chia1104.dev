"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState, useTransition } from "react";

import { Button, Spinner, ButtonGroup, ScrollShadow } from "@heroui/react";
import { useDebouncedCallback } from "@tanstack/react-pacer";
import { Search } from "lucide-react";

import {
  OllamaEmbeddingModel,
  TextEmbeddingModel,
} from "@chia/ai/embeddings/utils";
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

const SearchForm = ({ isOpen, onOpenChange }: SearchFormProps) => {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [locale, setLocale] = useState<Locale>(Locale.zhTW);
  const [model, setModel] = useState<
    TextEmbeddingModel | OllamaEmbeddingModel | "algolia"
  >("text-embedding-3-small");

  const supportedModels = [
    ...Object.values(TextEmbeddingModel),
    ...Object.values(OllamaEmbeddingModel),
    "algolia",
  ] as const;

  const {
    mutate: searchFeeds,
    data: feeds,
    isPending: isSearching,
    reset: resetSearch,
  } = useSearchFeeds();

  const handleSearch = useDebouncedCallback(
    (query: string) => {
      if (!query) return;
      searchFeeds({ query, locale, model });
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
        {feeds?.provider === "algolia"
          ? feeds?.items.map((feed) => (
              <CommandItem
                key={feed.objectID}
                onSelect={() => handleSelect(feed.feedID)}
                disabled={isPending}>
                <div className="flex flex-col gap-2">
                  <p className="text-sm font-medium">{feed.title}</p>
                  <p className="text-muted-foreground line-clamp-2 text-xs">
                    {feed.description}
                  </p>
                </div>
              </CommandItem>
            ))
          : feeds?.items.map((feed) => (
              <CommandItem
                key={feed.id}
                onSelect={() => handleSelect(feed.id)}
                disabled={isPending}>
                <div className="flex flex-col gap-2">
                  <p className="text-sm font-medium">{feed.title}</p>
                  <p className="text-muted-foreground line-clamp-2 text-xs">
                    {feed.description}
                  </p>
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
