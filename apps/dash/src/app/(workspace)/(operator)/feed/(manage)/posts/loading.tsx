import { ViewTransition } from "react";

import FeedSkeleton from "@/components/feed/skeleton";

const Loading = () => {
  return (
    <ViewTransition>
      <div className="grid w-full grid-cols-1 gap-5 md:grid-cols-2">
        <FeedSkeleton />
      </div>
    </ViewTransition>
  );
};

export default Loading;
