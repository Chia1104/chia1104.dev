"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";

import { Button, Skeleton } from "@heroui/react";
import { useMutation } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { toast } from "sonner";

import SearchFeed from "@/components/feed/search-feed";
import { orpc } from "@/libs/orpc/client";

const FeedTabs = dynamic(() => import("@/components/feed/feed-tabs"), {
  ssr: false,
  loading: () => <Skeleton className="h-10 w-[290px] rounded-full" />,
});

/** A new post starts as an empty draft on the server, so the agent can be invited into it at once. */
const CreateFeedButton = () => {
  const router = useRouter();
  const open = useMutation(
    orpc.feeds["draft:open"].mutationOptions({
      onSuccess: (draft) => router.push(`/feed/draft/${draft.id}`),
      onError: (error) =>
        toast.error(
          error instanceof Error ? error.message : "Could not create"
        ),
    })
  );

  return (
    <Button
      isPending={open.isPending}
      variant="primary"
      onPress={() => open.mutate({})}>
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
            <FeedTabs className="w-fit" />
            <div className="flex w-full items-center justify-between">
              <SearchFeed className="max-w-fit" />
              <CreateFeedButton />
            </div>
          </div>
          {children}
        </div>
      </section>
    </div>
  );
};

export default Layout;
