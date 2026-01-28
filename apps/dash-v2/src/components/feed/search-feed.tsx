"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState, useTransition } from "react";

import { Button, Spinner } from "@heroui/react";
import { useDebouncedCallback } from "@tanstack/react-pacer";
import { Search } from "lucide-react";

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
import type { FeedSearchResult } from "@/resources/feed.resource";

interface SearchFormProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

const SearchForm = ({ isOpen, onOpenChange }: SearchFormProps) => {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const {
    mutate: searchFeeds,
    data: feeds,
    isPending: isSearching,
  } = useSearchFeeds();

  const handleSearch = useDebouncedCallback(
    (query: string) => {
      if (!query || query.length < 3) return;
      searchFeeds({ query });
    },
    {
      wait: 500,
    }
  );

  const handleSelect = useCallback(
    (feed: FeedSearchResult) => {
      onOpenChange(false);
      startTransition(() => {
        router.push(`/feed/edit/${feed.id}`);
      });
    },
    [router, onOpenChange]
  );

  return (
    <CommandDialog
      open={isOpen}
      onOpenChange={onOpenChange}
      commandProps={{
        shouldFilter: false,
      }}>
      <CommandInput
        placeholder="Search Feeds"
        name="query"
        classNames={{
          wrapper: ["w-full", !feeds?.length && !isSearching && "border-none"],
        }}
        onValueChange={(value) => handleSearch(value)}
      />
      <CommandList>
        {isSearching && (
          <CommandLoading className="flex w-full justify-center py-10">
            <Spinner />
          </CommandLoading>
        )}
        {feeds?.length === 0 && <CommandEmpty>No results found.</CommandEmpty>}
        {feeds?.map((feed) => (
          <CommandItem
            key={feed.id}
            onSelect={() => handleSelect(feed)}
            disabled={isPending}>
            <div className="flex flex-col gap-2">
              <p className="text-sm font-medium">{feed.title}</p>
              <p className="text-muted-foreground text-xs">{feed.excerpt}</p>
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
