"use client";

import dynamic from "next/dynamic";

import Skeleton from "@/components/feed/skeleton";

const Drafts = dynamic(
  () => import("@/components/feed/feed-list").then((mod) => mod.Drafts),
  {
    loading: () => (
      <div className="grid w-full grid-cols-1 gap-5 md:grid-cols-2">
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
