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
  const post = await api.post.get.query({
    take: 5,
  });
  console.log(process.env.DATABASE_URL);
  return (
    <div className="c-container main mt-24">
      <FeedList data={post} />
    </div>
  );
};

const FeedList = async ({
  promise,
  data,
}: {
  promise?: Promise<RouterOutputs["post"]["get"]>;
  data?: RouterOutputs["post"]["get"];
}) => {
  const post = data ?? (await promise);
  return (
    <div>
      {post?.map((post) => {
        return <div key={post.id}>{post.title}</div>;
      }) ?? "Loading..."}
    </div>
  );
};

export default FeedPage;
