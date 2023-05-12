import FeedList from "./feed-list";
import { api } from "trpc-api";
import { Suspense } from "react";

const FeedPage = async () => {
  return (
    <div className="c-container main">
      <Suspense fallback={<p>LOADING!!!</p>}>
        <FeedList />
      </Suspense>
    </div>
  );
};

export default FeedPage;
