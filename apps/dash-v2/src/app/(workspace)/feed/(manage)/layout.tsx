"use client";

import { useRouter } from "next/navigation";
import type { ReactNode } from "react";

import { Button } from "@heroui/react";
import { Plus } from "lucide-react";

import FeedTabs from "@/components/feed/feed-tabs";
import SearchFeed from "@/components/feed/search-feed";

const CreateFeedButton = () => {
  const router = useRouter();
  return (
    <Button
      variant="primary"
      size="lg"
      onPress={() => router.push(`/feed/create?token=${crypto.randomUUID()}`)}>
      <Plus className="size-4" />
      Create Feed
    </Button>
  );
};
const Layout = ({ children }: { children: ReactNode }) => {
  return (
    <div className="flex w-full flex-col">
      <section className="flex min-h-screen w-full justify-center">
        <div className="w-full px-4 py-8 md:px-6 lg:px-8">
          <div className="mb-6 flex flex-col items-start gap-4">
            <div className="flex w-full items-center justify-between">
              <FeedTabs className="w-fit" />
              <CreateFeedButton />
            </div>
            <SearchFeed className="max-w-fit" />
          </div>
          {children}
        </div>
      </section>
    </div>
  );
};

export default Layout;
