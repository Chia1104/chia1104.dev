import { getAllPosts } from "@/helpers/mdx/services";
import { Chia } from "@/shared/meta/chia";
import { PostsList } from "./components";
import type { Metadata } from "next";
import { getBaseUrl } from "@/utils/getBaseUrl";
import { incrReadCount } from "@/helpers/action/kv.action";

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
        url: `${getBaseUrl({ isServer: true })}/api/og?title=Blog`,
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
    images: [`${getBaseUrl({ isServer: true })}/api/og?title=Blog`],
  },
};

const PostsPage = async () => {
  const posts = await getAllPosts();
  return (
    <article className="main c-container">
      <h1 className="title self-start py-10">
        <span>{Chia.name}</span> |{" "}
        <span className="c-text-bg-sec-half dark:c-text-bg-primary-half">
          Blog
        </span>
      </h1>
      <div className="flex w-full flex-col items-center justify-center">
        <PostsList
          post={posts}
          serverAction={{
            incrReadCount,
          }}
        />
      </div>
    </article>
  );
};

export default PostsPage;
