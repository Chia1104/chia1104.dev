import FeedList from "./feed-list";
import { prisma } from "db";
import { cache, Suspense } from "react";
import { RouterOutputs } from "api";
import { asyncComponent } from "@/utils/asyncComponent.util";

const getPosts = cache(async () => {
  return await prisma.post.findMany({
    take: 5,
    orderBy: {
      createdAt: "desc",
    },
  });
});

const FeedPage = async () => {
  // const post = await getPosts();
  return (
    <div className="c-container main mt-24">
      <FeedList />
      <h2>Promise feed</h2>
      <Suspense fallback={<div>Loading...</div>}>
        <PromiseFeedList promise={getPosts()} />
      </Suspense>
    </div>
  );
};

const PromiseFeedList = asyncComponent(
  async ({ promise }: { promise: Promise<RouterOutputs["post"]["get"]> }) => {
    const post = await promise;
    return (
      <div>
        {post.map((post) => {
          return <div key={post.id}>{post.title}</div>;
        })}
      </div>
    );
  }
);

export default FeedPage;
