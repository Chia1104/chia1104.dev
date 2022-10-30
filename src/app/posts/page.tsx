import { getAllPosts } from "@chia/helpers/mdx/services";
import { Chia } from "@chia/shared/meta/chia";
import { PostsList } from "@chia/components/client";

const PostsPage = async () => {
  const posts = await getAllPosts();
  return (
    <article className="main c-container">
      <h1 className="title py-10 self-start">
        <span>{Chia.name}</span> |{" "}
        <span className="c-text-bg-sec-half dark:c-text-bg-primary-half">
          Blog
        </span>
      </h1>
      <div className="flex flex-col w-full justify-center items-center">
        {posts && <PostsList post={posts} />}
      </div>
    </article>
  );
};

export const dynamic = "force-static";

export default PostsPage;
