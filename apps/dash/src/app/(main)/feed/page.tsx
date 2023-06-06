import FeedList from "./feed-list";
import { prisma } from "db";
import { cache, Suspense } from "react";
import { RouterOutputs } from "api";
import { asyncComponent } from "@/utils/asyncComponent.util";
import { api } from "trpc-api";

const getPosts = cache(async () => {
  return await prisma.post.findMany({
    take: 6,
    orderBy: {
      createdAt: "desc",
    },
  });
});

const FeedPage = async () => {
  const post = await api.post.infinite.query({ limit: 10 });
  return (
    <div className="c-container main mt-24">
      <FeedList
        initFeed={post.items}
        nextCursor={post.nextCursor}
        query={{ limit: 10 }}
      />
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
