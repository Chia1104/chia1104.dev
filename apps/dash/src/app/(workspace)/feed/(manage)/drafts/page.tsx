"use client";

import dynamic from "next/dynamic";
import { ViewTransition } from "react";

import FeedSkeleton from "@/components/feed/skeleton";
import { DraftProvider } from "@/store/draft";

const Drafts = dynamic(
  () => import("@/components/feed/feed-list").then((mod) => mod.Drafts),
  {
    loading: () => (
      <div className="grid w-full grid-cols-1 gap-5 md:grid-cols-2">
        <FeedSkeleton />
      </div>
    ),
    ssr: false,
  }
);

const DraftsPage = () => {
  return (
    <ViewTransition>
      <DraftProvider>
        <Drafts />
      </DraftProvider>
    </ViewTransition>
  );
};

export default DraftsPage;
