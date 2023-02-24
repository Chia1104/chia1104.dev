import { getAllPosts } from "@chia/helpers/mdx/services";
import { Chia } from "@chia/shared/meta/chia";
import { PostsList } from "@chia/components/client";
import { serialize } from "@chia/utils/hydration.util";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Blog",
  openGraph: {
    type: "article",
    locale: "zh_TW",
    url: "https://chia1104.dev/posts",
    siteName: Chia.name,
    title: "Blog",
    description: Chia.content,
    images: [
      {
        url: "https://chia1104.dev/api/og?title=Blog",
        width: 1200,
        height: 630,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: Chia.name,
    description: Chia.content,
    creator: `@${Chia.name.toLowerCase()}`,
    images: ["https://chia1104.dev/api/og?title=Blog"],
  },
};

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
        {posts && <PostsList post={serialize(posts)} />}
      </div>
    </article>
  );
};

export default PostsPage;
