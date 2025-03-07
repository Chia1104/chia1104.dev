"use client";

import dynamic from "next/dynamic";

import Skeleton from "@/components/feed/skeleton";

const Drafts = dynamic(
  () => import("@/components/feed/feed-list").then((mod) => mod.Drafts),
  {
    loading: () => (
      <div className="grid gap-5 grid-cols-1 md:grid-cols-2 w-full">
        <Skeleton />
      </div>
    ),
    ssr: false,
  }
);

const Page = () => {
  return <Drafts />;
};

export default Page;
