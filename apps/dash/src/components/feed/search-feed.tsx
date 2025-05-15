"use client";

import { useCallback } from "react";

import { Button, useDisclosure, Spinner } from "@heroui/react";
import type { ButtonProps } from "@heroui/react";
import { useDebouncedCallback } from "@tanstack/react-pacer";
import { Search } from "lucide-react";
import { useTransitionRouter } from "next-view-transitions";

import type { Feed } from "@chia/db/schema";
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

const SearchForm = ({
  isOpen,
  onOpenChange,
}: {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}) => {
  const router = useTransitionRouter();
  const { mutate: searchFeeds, data: feeds, isPending } = useSearchFeeds();
  const handleSearch = useDebouncedCallback(
    (query: string) => {
      if (!query || query.length < 3) return;
      searchFeeds(query);
    },
    {
      wait: 500, // Wait 500ms between executions
    }
  );

  const handleSelect = useCallback(
    (feed: Feed) => {
      router.push(`/feed/edit/${feed.id}`);
    },
    [router]
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
          wrapper: ["w-full", !feeds?.length && !isPending && "border-none"],
        }}
        onValueChange={(value) => handleSearch(value)}
      />
      <CommandList>
        {isPending && (
          <CommandLoading className="w-full justify-center flex py-10">
            <Spinner />
          </CommandLoading>
        )}
        {feeds?.length === 0 && <CommandEmpty>No results found.</CommandEmpty>}
        {feeds?.map((feed) => (
          <CommandItem key={feed.id} onSelect={() => handleSelect(feed)}>
            <div className="flex flex-col gap-2">
              <p className="text-sm font-medium">{feed.title}</p>
              <p className="text-xs text-muted-foreground">{feed.excerpt}</p>
            </div>
          </CommandItem>
        ))}
      </CommandList>
    </CommandDialog>
  );
};

const SearchFeed = (props: ButtonProps) => {
  const { isOpen, onOpen, onOpenChange } = useDisclosure();

  return (
    <>
      <Button
        radius="full"
        variant="bordered"
        startContent={<Search className="size-4" />}
        fullWidth={false}
        className={cn(props.className)}
        {...props}
        onPress={onOpen}>
        Search Feeds
      </Button>
      <SearchForm isOpen={isOpen} onOpenChange={onOpenChange} />
    </>
  );
};

export default SearchFeed;
