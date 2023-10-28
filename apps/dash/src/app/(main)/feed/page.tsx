import { api } from "@/trpc-api/server";
import FeedList from "./feed-list";

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

// const FeedList = async ({
//   promise,
//   data,
// }: {
//   promise?: Promise<RouterOutputs["post"]["get"]>;
//   data?: RouterOutputs["post"]["get"];
// }) => {
//   const post = data ?? (await promise);
//   return (
//     <div>
//       {post?.map((post) => {
//         return <div key={post.id}>{post.title}</div>;
//       }) ?? "Loading..."}
//     </div>
//   );
// };

export default FeedPage;
