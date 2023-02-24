import { getAllPosts, getPost } from "@chia/helpers/mdx/services";
import { MDXRemote, Image, Giscus } from "@chia/components/client";
import "highlight.js/styles/atom-one-dark-reasonable.css";
import { Chip } from "@chia/components/server";
import dayjs from "dayjs";
import { serialize } from "@chia/utils/hydration.util";
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
  console.log(params);
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
        <header className="pl-3 lg:w-[70%] w-full mb-7 self-center">
          <h1 className="title pb-5">{frontMatter?.title}</h1>
          <h2 className="c-description">{frontMatter?.excerpt}</h2>
          <span className="mt-5 flex items-center c-description gap-2">
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
        <div className="c-bg-secondary p-5 mt-5 rounded-xl lg:w-[70%] w-full self-center mx-auto">
          <MDXRemote post={serialize(source)} />
        </div>
        <div className="mt-20 lg:w-[70%] w-full self-center mx-auto">
          <Giscus title={frontMatter?.title || ""} />
        </div>
      </article>
    );
  } catch (error) {
    notFound();
  }
};

export default PostDetailPage;
