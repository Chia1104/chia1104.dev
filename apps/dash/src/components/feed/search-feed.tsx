"use client";

import { useCallback } from "react";

import { Form, Button, useDisclosure, Spinner } from "@heroui/react";
import type { ButtonProps } from "@heroui/react";
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

const SearchForm = () => {
  const router = useTransitionRouter();
  const { mutate: searchFeeds, data: feeds, isPending } = useSearchFeeds();
  const handleSubmit = useCallback(
    (
      e:
        | React.FormEvent<HTMLFormElement>
        | React.KeyboardEvent<HTMLInputElement>,
      dom: "form" | "input"
    ) => {
      e.preventDefault();
      if (dom === "input") {
        const value = (e.target as HTMLInputElement).value;
        searchFeeds(value);
        return;
      }
      const formData = new FormData(e.target as HTMLFormElement);
      const query = formData.get("query") as string;
      searchFeeds(query);
    },
    [searchFeeds]
  );

  const handleSelect = useCallback(
    (feed: Feed) => {
      router.push(`/feed/edit/${feed.id}`);
    },
    [router]
  );

  return (
    <>
      <Form className="w-full" onSubmit={(e) => handleSubmit(e, "form")}>
        <CommandInput
          placeholder="Search Feeds"
          name="query"
          classNames={{
            wrapper: ["w-full", !feeds?.length && !isPending && "border-none"],
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              handleSubmit(e, "input");
            }
          }}
        />
      </Form>
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
    </>
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
      <CommandDialog
        open={isOpen}
        onOpenChange={onOpenChange}
        commandProps={{
          shouldFilter: false,
        }}>
        <SearchForm />
      </CommandDialog>
    </>
  );
};

export default SearchFeed;
