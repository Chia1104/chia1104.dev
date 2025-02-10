"use client";

import type { FC } from "react";

import { Skeleton as NSkeleton } from "@heroui/react";

const Skeleton: FC = () => {
  return (
    <>
      {[1, 2, 3, 4, 5].map((i) => (
        <NSkeleton
          className="rounded-lg duration-700 before:animate-[shimmer_5s_infinite]"
          key={i}>
          <div className="bg-default-300 min-h-[120px] w-full rounded-lg" />
        </NSkeleton>
      ))}
    </>
  );
};

export default Skeleton;
