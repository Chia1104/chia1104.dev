import { getAllPosts, getPost } from "@chia/helpers/mdx/services";
import { MDXRemote, Image, Giscus } from "@chia/components/client";
import "highlight.js/styles/atom-one-dark-reasonable.css";
import { Chip } from "@chia/components/server";
import dayjs from "dayjs";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

export const generateStaticParams = async () => {
  const posts = await getAllPosts();

  return posts.map((post) => ({
    slug: post.slug,
  }));
};

// Global not found page
// export const dynamicParams = false;

export const generateMetadata = async ({
  params,
}: {
  params: any;
}): Promise<Metadata> => {
  try {
    const { frontMatter } = await getPost(params.slug);
    return {
      title: frontMatter?.title,
      openGraph: {
        type: "article",
        locale: "zh_TW",
        url: `https://chia1104.dev/posts/${params.slug}`,
        siteName: "Chia",
        title: frontMatter?.title,
        description: frontMatter?.excerpt,
        images: [
          {
            url: `https://chia1104.dev/api/og?title=${encodeURIComponent(
              frontMatter?.title ?? ""
            )}`,
            width: 1200,
            height: 630,
          },
        ],
      },
      twitter: {
        card: "summary_large_image",
        title: "Chia",
        description: frontMatter?.excerpt,
        creator: "@chia1104",
        images: [
          `https://chia1104.dev/api/og?title=${encodeURIComponent(
            frontMatter?.title ?? ""
          )}`,
        ],
      },
    };
  } catch (error) {
    console.error(error);
    return {};
  }
};

const PostDetailPage = async ({ params }: { params?: any }) => {
  try {
    const { frontMatter, source } = await getPost(params.slug);
    return (
      <article className="main c-container mt-10 px-5">
        <header className="mb-7 w-full self-center pl-3 lg:w-[70%]">
          <h1 className="title pb-5">{frontMatter?.title}</h1>
          <h2 className="c-description">{frontMatter?.excerpt}</h2>
          <span className="c-description mt-5 flex items-center gap-2">
            <Image
              src="/memoji/contact-memoji.PNG"
              width={40}
              height={40}
              className="rounded-full"
              alt="Chia1104"
            />
            {dayjs(frontMatter?.createdAt).format("MMMM D, YYYY")} &mdash;{" "}
            {frontMatter?.readingMins}
          </span>
          <Chip data={frontMatter?.tags || []} />
        </header>
        <div className="c-bg-secondary mx-auto mt-5 w-full self-center rounded-xl p-5 lg:w-[70%]">
          <MDXRemote post={source} />
        </div>
        <div className="mx-auto mt-20 w-full self-center lg:w-[70%]">
          <Giscus title={frontMatter?.title || ""} />
        </div>
      </article>
    );
  } catch (error) {
    notFound();
  }
};

export default PostDetailPage;
