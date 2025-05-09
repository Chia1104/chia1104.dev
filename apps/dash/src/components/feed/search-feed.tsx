"use client";

import { useCallback } from "react";

import { Input } from "@heroui/react";
import { Search } from "lucide-react";

import { useSearchFeeds } from "@/hooks/use-search-feeds";

const SearchFeed = () => {
  const { mutate: searchFeeds } = useSearchFeeds();
  const handleSubmit = useCallback(
    (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      const formData = new FormData(e.target as HTMLFormElement);
      const query = formData.get("query") as string;
      searchFeeds(query);
    },
    [searchFeeds]
  );
  return (
    <form onSubmit={handleSubmit}>
      <Input
        className="max-w-[300px] mb-10"
        size="sm"
        endContent={<Search className="size-4" />}
        isDisabled
      />
    </form>
  );
};

export default SearchFeed;
