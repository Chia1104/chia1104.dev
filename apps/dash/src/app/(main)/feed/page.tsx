import { prisma } from "@chia/db";
import { cache, Suspense } from "react";
import { RouterOutputs } from "@chia/api";
import { api } from "@/trpc-api/server";

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
      <PromiseFeedList promise={getPosts()} />
    </div>
  );
};

const PromiseFeedList = async ({
  promise,
}: {
  promise: Promise<RouterOutputs["post"]["get"]>;
}) => {
  const post = await promise;
  return (
    <div>
      {post.map((post) => {
        return <div key={post.id}>{post.title}</div>;
      })}
    </div>
  );
};

export default FeedPage;
