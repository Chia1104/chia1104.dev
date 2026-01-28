"use client";

import { Skeleton } from "@heroui/react";

// rendering-hoist-jsx: Extract static JSX outside components
const SKELETON_ITEMS = Array.from({ length: 5 }, (_, i) => i);

const FeedSkeleton = () => {
  return (
    <>
      {SKELETON_ITEMS.map((i) => (
        <div key={i} className="w-full">
          <Skeleton className="min-h-[120px] w-full rounded-lg" />
        </div>
      ))}
    </>
  );
};

export default FeedSkeleton;
