"use client";

import { type FC } from "react";
import { Skeleton as NSkeleton } from "@nextui-org/react";

const Skeleton: FC = () => {
  return (
    <>
      {[1, 2, 3, 4, 5].map((i) => (
        <NSkeleton key={i} className="h-[100px] w-full rounded-xl">
          LOADING
        </NSkeleton>
      ))}
    </>
  );
};

export default Skeleton;
