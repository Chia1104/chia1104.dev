"use client";

import dynamic from "next/dynamic";
import { ViewTransition } from "react";

import FeedSkeleton from "@/components/feed/skeleton";

const DraftList = dynamic(
  () => import("@/components/feed/draft-list").then((mod) => mod.DraftList),
  {
    loading: () => (
      <div className="page-md:grid-cols-2 grid w-full grid-cols-1 gap-5">
        <FeedSkeleton />
      </div>
    ),
    ssr: false,
  }
);

const DraftsPage = () => {
  return (
    <ViewTransition>
      <DraftList />
    </ViewTransition>
  );
};

export default DraftsPage;
