import { getAllPosts } from "@/helpers/mdx/services/index.ts";
import { Chia } from "@/shared/meta/chia.ts";
import { PostsList } from "./components/index.ts";
import type { Metadata } from "next";
import { getBaseUrl } from "@/utils/getBaseUrl.ts";

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
        <PostsList post={posts} />
      </div>
    </article>
  );
};

export default PostsPage;
