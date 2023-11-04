import { getAllPosts } from "@/helpers/mdx/services";
import { Chia } from "@/shared/meta/chia";
import PostsList from "./posts-list";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Blog",
};

const PostsPage = async () => {
  const posts = await getAllPosts();
  return (
    <article className="main c-container">
      <h1 className="title self-start py-10">read my posts</h1>
      <div className="flex w-full flex-col items-center justify-center">
        <PostsList post={posts} />
      </div>
    </article>
  );
};

export default PostsPage;
