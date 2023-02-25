"use client";

import type { FC } from "react";

const VideoLoader: FC = () => {
  return (
    <div className="grid w-full grid-cols-1 gap-3 xl:grid-cols-2">
      <div className="flex w-full flex-col items-center justify-center">
        <div className="mb-5 h-5 animate-pulse bg-white dark:bg-dark " />
        <div className="mx-auto h-[270px] w-full animate-pulse overflow-hidden rounded-lg border-0 bg-white shadow-lg dark:bg-dark sm:h-[300px] sm:w-[500px]" />
      </div>
      <div className="my-5">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="c-border-primary flex h-[130px] w-full flex-col border-b-2 p-3">
            <div className="mb-3 h-5 animate-pulse bg-white dark:bg-dark" />
            <div className="h-12 animate-pulse bg-white dark:bg-dark" />
            <div className="mt-auto h-3 w-40 animate-pulse bg-white dark:bg-dark" />
          </div>
        ))}
      </div>
    </div>
  );
};

export default VideoLoader;
